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
from .comparison import obtener_factura_anterior
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

        file_type = (invoice.file_type or '').lower()
        content_type_map = {
            'pdf':  'application/pdf',
            'png':  'image/png',
            'jpg':  'image/jpeg',
            'jpeg': 'image/jpeg',
        }
        content_type = content_type_map.get(file_type, 'application/octet-stream')
        file_name = invoice.file_name or f'factura_{invoice.id}.{file_type}'

        response = HttpResponse(bytes(invoice.file_data), content_type=content_type)
        response['Content-Disposition'] = f'inline; filename="{file_name}"'
        return response

    # ------------------------------------------------------------------
    # Endpoints de comparación de precios
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get'], url_path='comparar-anterior')
    def comparar_anterior(self, request, pk=None):
        """Comparación automática con la factura anterior del mismo proveedor."""
        from .comparison import obtener_factura_anterior
        from decimal import Decimal

        user = request.user
        if user.is_staff:
            factura = get_object_or_404(Invoice, pk=pk)
        else:
            factura = get_object_or_404(Invoice, pk=pk, user=user)

        factura_anterior = obtener_factura_anterior(factura)

        if factura_anterior is None:
            return Response({
                'factura_actual': {
                    'id': factura.id,
                    'numero': factura.invoice_number,
                    'fecha_emision': factura.issue_date,
                    'proveedor': factura.provider.name if factura.provider else None,
                },
                'factura_anterior': None,
                'productos_comunes': [],
                'mensaje': 'No existe factura anterior para este proveedor',
            })

        # Calcular comparación
        items_base = {
            item.product_id: item
            for item in factura_anterior.items.select_related('product').all()
            if item.product_id is not None
        }
        items_actual = {
            item.product_id: item
            for item in factura.items.select_related('product').all()
            if item.product_id is not None
        }
        common_ids = set(items_base.keys()) & set(items_actual.keys())

        productos_comunes = []
        for pid in common_ids:
            item_base = items_base[pid]
            item_actual = items_actual[pid]
            precio_anterior = item_base.unit_price or Decimal('0')
            precio_actual = item_actual.unit_price or Decimal('0')
            diferencia = precio_actual - precio_anterior
            variacion = (diferencia / precio_anterior * Decimal('100')) if precio_anterior else None
            productos_comunes.append({
                'producto_id': pid,
                'producto_nombre': item_actual.product.name if item_actual.product else item_actual.description,
                'precio_anterior': float(precio_anterior),
                'precio_actual': float(precio_actual),
                'diferencia': float(diferencia),
                'variacion_porcentual': float(variacion) if variacion else None,
            })

        return Response({
            'factura_actual': {
                'id': factura.id,
                'numero': factura.invoice_number,
                'fecha_emision': factura.issue_date,
                'proveedor': factura.provider.name if factura.provider else None,
            },
            'factura_anterior': {
                'id': factura_anterior.id,
                'numero': factura_anterior.invoice_number,
                'fecha_emision': factura_anterior.issue_date,
                'proveedor': factura_anterior.provider.name if factura_anterior.provider else None,
            },
            'productos_comunes': productos_comunes,
            'mensaje': None if productos_comunes else 'No hay productos en común entre las facturas',
        })

    @action(detail=False, methods=['get'], url_path='comparar-manual')
    def comparar_manual(self, request):
        """Comparación manual entre dos facturas específicas."""
        from decimal import Decimal

        user = request.user
        factura_base_id = request.query_params.get('factura_base')
        factura_comparar_id = request.query_params.get('factura_comparar')

        if not factura_base_id or not factura_comparar_id:
            return Response(
                {'error': 'Se requieren los parámetros factura_base y factura_comparar'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.is_staff:
            factura_base = get_object_or_404(Invoice, pk=factura_base_id)
            factura_comparar = get_object_or_404(Invoice, pk=factura_comparar_id)
        else:
            factura_base = get_object_or_404(Invoice, pk=factura_base_id, user=user)
            factura_comparar = get_object_or_404(Invoice, pk=factura_comparar_id, user=user)

        if factura_base.status != 'completed' or factura_comparar.status != 'completed':
            return Response({'error': 'Ambas facturas deben estar completadas'}, status=status.HTTP_400_BAD_REQUEST)

        if factura_base.provider_id != factura_comparar.provider_id:
            return Response({'error': 'Las facturas deben pertenecer al mismo proveedor'}, status=status.HTTP_400_BAD_REQUEST)

        items_base = {item.product_id: item for item in factura_base.items.select_related('product').all() if item.product_id}
        items_actual = {item.product_id: item for item in factura_comparar.items.select_related('product').all() if item.product_id}
        common_ids = set(items_base.keys()) & set(items_actual.keys())

        productos_comunes = []
        for pid in common_ids:
            ib, ia = items_base[pid], items_actual[pid]
            pa = ib.unit_price or Decimal('0')
            pc = ia.unit_price or Decimal('0')
            diff = pc - pa
            var = (diff / pa * Decimal('100')) if pa else None
            productos_comunes.append({
                'producto_id': pid,
                'producto_nombre': ia.product.name if ia.product else ia.description,
                'precio_anterior': float(pa),
                'precio_actual': float(pc),
                'diferencia': float(diff),
                'variacion_porcentual': float(var) if var else None,
            })

        return Response({
            'factura_actual': {'id': factura_comparar.id, 'numero': factura_comparar.invoice_number, 'fecha_emision': factura_comparar.issue_date, 'proveedor': factura_comparar.provider.name if factura_comparar.provider else None},
            'factura_anterior': {'id': factura_base.id, 'numero': factura_base.invoice_number, 'fecha_emision': factura_base.issue_date, 'proveedor': factura_base.provider.name if factura_base.provider else None},
            'productos_comunes': productos_comunes,
            'mensaje': None if productos_comunes else 'No hay productos en común entre las facturas',
        })

    @action(detail=False, methods=['get'], url_path='comparar-mes')
    def comparar_mes(self, request):
        """Resumen mensual de precios por proveedor."""
        from decimal import Decimal
        from collections import defaultdict

        user = request.user
        proveedor_id = request.query_params.get('proveedor_id')
        if not proveedor_id:
            return Response({'error': 'Se requiere el parámetro proveedor_id'}, status=status.HTTP_400_BAD_REQUEST)

        get_object_or_404(Provider, pk=proveedor_id)
        today = date.today()
        try:
            year = int(request.query_params.get('year', today.year))
            month = int(request.query_params.get('month', today.month))
        except (ValueError, TypeError):
            year, month = today.year, today.month

        facturas = Invoice.objects.filter(
            provider_id=proveedor_id, user=user, status='completed',
            issue_date__year=year, issue_date__month=month,
        ).order_by('issue_date').select_related('provider')

        facturas_list = list(facturas)
        if not facturas_list:
            prov = Provider.objects.get(id=proveedor_id)
            return Response({
                'proveedor': prov.name, 'periodo': {'year': year, 'month': month},
                'facturas': [], 'productos': [],
                'mensaje': 'No hay facturas de este proveedor en el período indicado',
            })

        product_data = defaultdict(list)
        product_names = {}
        for item in InvoiceItem.objects.filter(invoice__in=facturas_list).exclude(product_id__isnull=True).select_related('product', 'invoice'):
            product_data[item.product_id].append(item.unit_price or Decimal('0'))
            if item.product_id not in product_names and item.product:
                product_names[item.product_id] = item.product.name

        productos = []
        for pid, prices in product_data.items():
            var = None
            if len(prices) >= 2:
                first, last = prices[0], prices[-1]
                var = float((last - first) / first * Decimal('100')) if first else None
            productos.append({
                'producto_id': pid, 'producto_nombre': product_names.get(pid, ''),
                'precio_minimo': float(min(prices)), 'precio_maximo': float(max(prices)),
                'precio_promedio': float(sum(prices) / len(prices)),
                'variacion_porcentual': var,
            })

        return Response({
            'proveedor': facturas_list[0].provider.name,
            'periodo': {'year': year, 'month': month},
            'facturas': [{'id': f.id, 'numero': f.invoice_number, 'fecha_emision': f.issue_date} for f in facturas_list],
            'productos': productos,
            'mensaje': None,
        })

    @action(detail=False, methods=['get'], url_path='comparar-proveedores')
    def comparar_proveedores(self, request):
        """Comparación de precios del mismo producto entre distintos proveedores."""
        from decimal import Decimal
        from collections import defaultdict

        items = InvoiceItem.objects.filter(
            invoice__user=request.user, invoice__status='completed',
        ).exclude(product_id__isnull=True).select_related('product', 'invoice__provider').order_by('invoice__issue_date')

        product_providers = defaultdict(dict)
        product_names = {}
        for item in items:
            prov = item.invoice.provider
            if not prov:
                continue
            product_providers[item.product_id][prov.id] = {
                'proveedor_id': prov.id, 'proveedor_nombre': prov.name,
                'precio': item.unit_price or Decimal('0'),
                'fecha': item.invoice.issue_date, 'factura': item.invoice.invoice_number,
            }
            if item.product_id not in product_names and item.product:
                product_names[item.product_id] = item.product.name

        productos = []
        for pid, proveedores in product_providers.items():
            if len(proveedores) < 2:
                continue
            precios_list = list(proveedores.values())
            mejor = min(precios_list, key=lambda x: x['precio'])
            mejor_precio = mejor['precio']  # Guardar como Decimal antes de convertir
            for p in precios_list:
                diff = p['precio'] - mejor_precio
                var = (diff / mejor_precio * Decimal('100')) if mejor_precio else None
                p['diferencia'] = float(diff)
                p['variacion_porcentual'] = float(var) if var else None
                p['precio'] = float(p['precio'])
                p['fecha'] = str(p['fecha']) if p['fecha'] else None
            productos.append({
                'producto_id': pid, 'producto_nombre': product_names.get(pid, ''),
                'mejor_proveedor': mejor['proveedor_nombre'], 'mejor_precio': float(mejor_precio),
                'proveedores': precios_list,
            })

        return Response({
            'productos': productos, 'total_productos': len(productos),
            'mensaje': None if productos else 'No hay productos compartidos entre proveedores',
        })
