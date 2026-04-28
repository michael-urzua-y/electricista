from datetime import date
from decimal import Decimal

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.db.models import Prefetch
import logging
from .models import Invoice, InvoiceItem
from products.models import Provider
from .serializers import InvoiceListSerializer, InvoiceDetailSerializer, InvoiceUploadSerializer, InvoiceItemSerializer
from .comparison_serializers import (
    ComparacionAutomaticaSerializer,
    ComparacionMensualSerializer,
)
from .comparison import obtener_factura_anterior, calcular_comparacion, comparar_mes as comparar_mes_service, comparar_entre_proveedores
from .ocr import OCRProcessor
from .ai_parser import InvoiceAIParser
from .services import process_invoice
from .tasks import process_invoice_task
from django.db import transaction

logger = logging.getLogger(__name__)


class FacturaViewSet(viewsets.ModelViewSet):
    """API para gestionar facturas"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            qs = Invoice.objects.all()
        else:
            qs = Invoice.objects.filter(user=user)
        
        # Optimizaciones de performance
        if self.action == 'list':
            qs = qs.select_related('user', 'provider').only(
                'id', 'invoice_number', 'issue_date', 'total_amount', 'status',
                'provider__name', 'user__username', 'file_name', 'file_type',
                'created_at'
            )
        elif self.action == 'retrieve':
            qs = qs.select_related('user', 'provider').prefetch_related(
                Prefetch('items', queryset=InvoiceItem.objects.select_related('product'))
            )
        
        # Filtros opcionales
        provider = self.request.query_params.get('provider')
        status_filter = self.request.query_params.get('status')
        if provider:
            qs = qs.filter(provider_id=provider)
        if status_filter:
            qs = qs.filter(status=status_filter)
        
        return qs

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
        Procesa la factura:
        1. Lee el archivo en memoria y guarda como binario en BD
        2. NO guarda archivo físico en el filesystem
        3. Envía a Celery para procesar OCR + IA en segundo plano
        """
        user = self.request.user
        uploaded_file = self.request.FILES.get('file')

        # Leer el archivo completo en memoria
        file_content = uploaded_file.read() if uploaded_file else None
        file_name = uploaded_file.name if uploaded_file else None
        file_size = len(file_content) if file_content else None
        file_ext = file_name.rsplit('.', 1)[-1].lower() if file_name and '.' in file_name else None

        # Guardar SIN el campo 'file' para evitar escritura en filesystem
        # Excluimos 'file' de validated_data antes de guardar
        serializer.validated_data.pop('file', None)

        invoice = serializer.save(
            user=user,
            file_data=file_content,
            file_name=file_name,
            file_size=file_size,
            file_type=file_ext,
        )

        # Enviar a Celery para procesar OCR + IA en segundo plano
        process_invoice_task.delay(invoice.id)

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

    @action(detail=True, methods=['patch'], url_path='update-item',
            parser_classes=[JSONParser, MultiPartParser])
    def update_item(self, request, pk=None):
        """Permite actualizar el porcentaje de ganancia de un producto específico en la factura"""
        invoice = self.get_object()
        item_id = request.data.get('item_id')
        
        if not item_id:
            return Response({'error': 'item_id es requerido'}, status=status.HTTP_400_BAD_REQUEST)
            
        item = get_object_or_404(InvoiceItem, pk=item_id, invoice=invoice)
        
        if 'markup_percentage' in request.data:
            try:
                item.markup_percentage = Decimal(str(request.data['markup_percentage']))
                item.save()
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
                
        serializer = InvoiceItemSerializer(item)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    # Endpoint para visualizar el archivo original de la factura
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get'], url_path='ver-factura')
    def ver_factura(self, request, pk=None):
        """Reconstruye y sirve el archivo original de la factura desde binario en BD."""
        user = request.user
        if user.is_staff:
            invoice = get_object_or_404(Invoice, pk=pk)
        else:
            invoice = get_object_or_404(Invoice, pk=pk, user=user)

        if not invoice.file_data:
            return Response(
                {'error': 'No hay archivo disponible para esta factura'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Determinar content type
        file_type = (invoice.file_type or '').lower()
        content_type_map = {
            'pdf':  'application/pdf',
            'png':  'image/png',
            'jpg':  'image/jpeg',
            'jpeg': 'image/jpeg',
        }
        content_type = content_type_map.get(file_type, 'application/octet-stream')
        file_name = invoice.file_name or f'factura_{invoice.id}.{file_type}'

        # Reconstruir el archivo desde binario y enviarlo al navegador
        response = HttpResponse(bytes(invoice.file_data), content_type=content_type)
        response['Content-Disposition'] = f'inline; filename="{file_name}"'
        return response

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

    @action(detail=False, methods=['get'], url_path='comparar-proveedores')
    def comparar_proveedores(self, request):
        """Comparación de precios del mismo producto entre distintos proveedores."""
        resultado = comparar_entre_proveedores(request.user)
        return Response(resultado)
