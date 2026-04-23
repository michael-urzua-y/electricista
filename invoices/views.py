from datetime import date

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
import logging
from .models import Invoice, InvoiceItem
from products.models import Provider
from .serializers import InvoiceListSerializer, InvoiceDetailSerializer, InvoiceUploadSerializer
from .comparison_serializers import (
    ComparacionAutomaticaSerializer,
    ComparacionMensualSerializer,
)
from .comparison import obtener_factura_anterior, calcular_comparacion, comparar_mes as comparar_mes_service
from .ocr import OCRProcessor
from .ai_parser import InvoiceAIParser
from django.db import transaction

logger = logging.getLogger(__name__)


class FacturaViewSet(viewsets.ModelViewSet):
    """API para gestionar facturas"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        user = self.request.user
        # Los usuarios solo ven sus facturas, los staff ven todas
        if user.is_staff:
            return Invoice.objects.all().select_related('user', 'provider')
        return Invoice.objects.filter(user=user).select_related('user', 'provider')

    def get_serializer_class(self):
        if self.action == 'list':
            return InvoiceListSerializer
        elif self.action == 'create':
            return InvoiceUploadSerializer
        return InvoiceDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to inject previous invoice item data into serializer context."""
        instance = self.get_object()
        factura_anterior = obtener_factura_anterior(instance)
        items_anteriores = None
        if factura_anterior is not None:
            items_anteriores = {
                item.product_id: item
                for item in factura_anterior.items.select_related('product').all()
                if item.product_id is not None
            }
        serializer = self.get_serializer(instance, context={
            **self.get_serializer_context(),
            'items_anteriores': items_anteriores,
        })
        return Response(serializer.data)

    def perform_create(self, serializer):
        """
        Procesa la factura inmediatamente (síncrono):
        1. Guarda factura en estado 'processing'
        2. Extrae texto con OCR
        3. Parsea con IA (Mistral)
        4. Crea InvoiceItems
        5. Calcula total_amount
        6. Marca 'completed'
        """
        user = self.request.user
        provider = serializer.validated_data.get('provider')
        
        try:
            # Guardar factura inicial (user asignado desde perform_create)
            invoice = serializer.save(user=user)
            invoice.status = 'processing'
            invoice.save()
            
            # --- OCR ---
            ocr_processor = OCRProcessor()
            file_path = invoice.file.path
            file_type = invoice.file_type or file_path.split('.')[-1].lower()
            ocr_text = ocr_processor.extract_text(
                file_path=file_path,
                file_type=file_type
            )
            invoice.ocr_text = ocr_text
            
            # --- IA Parser ---
            parser = InvoiceAIParser()
            parsed_data = parser.parse(ocr_text)
            
            # --- Guardar ítems y calcular total ---
            total_amount = 0
            with transaction.atomic():
                for item_data in parsed_data.get('items', []):
                    desc = item_data.get('description', '')
                    quantity = item_data.get('quantity', 1) or 1
                    unit_price = item_data.get('unit_price')
                    total_price = item_data.get('total_price')
                    
                    # Calcular precios faltantes
                    if unit_price is None and total_price is not None:
                        try:
                            unit_price = float(total_price) / float(quantity)
                        except:
                            unit_price = 0
                    if total_price is None and unit_price is not None:
                        try:
                            total_price = float(unit_price) * float(quantity)
                        except:
                            total_price = 0
                    
                    item_total = total_price or 0
                    total_amount += item_total
                    
                    # Buscar o crear producto (genérico, sin proveedor fijo)
                    product = None
                    if desc:
                        from products.models import Product
                        # Buscar por nombre exacto (case-insensitive)
                        product = Product.objects.filter(
                            name__iexact=desc[:200],
                            is_active=True
                        ).first()
                        if not product:
                            # Crear producto genérico (sin proveedor)
                            product = Product.objects.create(
                                name=desc[:200],
                                provider=None,  # NO asignamos proveedor aquí
                                category='general',
                                is_active=True
                            )
                            logger.info(f"Producto creado: {product.name}")
                        # Si existe, lo usamos (no cambiamos su provider)
                    
                    invoice_item = InvoiceItem.objects.create(
                        invoice=invoice,
                        product=product,
                        description=desc,
                        quantity=quantity,
                        unit_price=unit_price,
                        total_price=total_price,
                        unit_measure=item_data.get('unit_measure'),
                        needs_review=product is None
                    )
                    
                    # Si el ítem tiene producto vinculado, registrar en historial de precios
                    if product and unit_price:
                        from products.models import PriceHistory
                        PriceHistory.objects.create(
                            product=product,
                            provider=provider,
                            price=unit_price,
                            currency=invoice.currency
                        )
                
                # Actualizar factura
                invoice.total_amount = total_amount
                invoice.status = 'completed'
                invoice.save()
                
        except Exception as e:
            logger.error(f"Error procesando factura: {e}", exc_info=True)
            # Si ya creamos la factura, marcarla como fallida
            try:
                invoice.status = 'failed'
                invoice.processing_notes = str(e)
                invoice.save()
            except:
                pass
            raise
        
        return invoice

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Estadísticas de facturas del usuario"""
        user = request.user
        from django.db.models import Sum, Avg, Count
        stats = Invoice.objects.filter(user=user).aggregate(
            total_invoices=Count('id'),
            total_spent=Sum('total_amount'),
            avg_amount=Avg('total_amount')
        )
        return Response(stats)

    # ------------------------------------------------------------------
    # Endpoints de comparación de precios
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get'], url_path='comparar-anterior')
    def comparar_anterior(self, request, pk=None):
        """Comparación automática con la factura anterior del mismo proveedor."""
        user = request.user
        # Verificar que la factura existe y pertenece al usuario (o es staff)
        if user.is_staff:
            factura = get_object_or_404(Invoice, pk=pk)
        else:
            factura = get_object_or_404(Invoice, pk=pk, user=user)

        factura_anterior = obtener_factura_anterior(factura)

        if factura_anterior is None:
            data = {
                'factura_actual': {
                    'id': factura.id,
                    'numero': factura.invoice_number,
                    'fecha_emision': factura.issue_date,
                    'proveedor': factura.provider.name if factura.provider else None,
                },
                'factura_anterior': None,
                'productos_comunes': [],
                'mensaje': 'No existe factura anterior para este proveedor',
            }
            serializer = ComparacionAutomaticaSerializer(data)
            return Response(serializer.data)

        resultado = calcular_comparacion(factura, factura_anterior)
        serializer = ComparacionAutomaticaSerializer(resultado)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='comparar-manual')
    def comparar_manual(self, request):
        """Comparación manual entre dos facturas específicas."""
        user = request.user
        factura_base_id = request.query_params.get('factura_base')
        factura_comparar_id = request.query_params.get('factura_comparar')

        if not factura_base_id or not factura_comparar_id:
            return Response(
                {'error': 'Se requieren los parámetros factura_base y factura_comparar'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validar que ambas facturas pertenecen al usuario o es staff
        if user.is_staff:
            factura_base = get_object_or_404(Invoice, pk=factura_base_id)
            factura_comparar = get_object_or_404(Invoice, pk=factura_comparar_id)
        else:
            factura_base = get_object_or_404(Invoice, pk=factura_base_id, user=user)
            factura_comparar = get_object_or_404(Invoice, pk=factura_comparar_id, user=user)

        # Validar estado completado
        if factura_base.status != 'completed' or factura_comparar.status != 'completed':
            return Response(
                {'error': 'Ambas facturas deben estar completadas'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validar mismo proveedor
        if factura_base.provider_id != factura_comparar.provider_id:
            return Response(
                {'error': 'Las facturas deben pertenecer al mismo proveedor'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        resultado = calcular_comparacion(factura_comparar, factura_base)
        serializer = ComparacionAutomaticaSerializer(resultado)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='comparar-mes')
    def comparar_mes(self, request):
        """Resumen mensual de precios por proveedor."""
        user = request.user
        proveedor_id = request.query_params.get('proveedor_id')

        if not proveedor_id:
            return Response(
                {'error': 'Se requiere el parámetro proveedor_id'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validar que el proveedor existe
        get_object_or_404(Provider, pk=proveedor_id)

        today = date.today()
        try:
            year = int(request.query_params.get('year', today.year))
            month = int(request.query_params.get('month', today.month))
        except (ValueError, TypeError):
            year = today.year
            month = today.month

        resultado = comparar_mes_service(
            proveedor_id=proveedor_id,
            user=user,
            year=year,
            month=month,
        )
        serializer = ComparacionMensualSerializer(resultado)
        return Response(serializer.data)
