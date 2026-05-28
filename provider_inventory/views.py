"""
API Views para provider_inventory.
"""
import logging
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from .models import ProviderInventory
from .serializers import (
    ProviderInventorySerializer,
    ProviderInventoryDetailSerializer,
    LowStockItemSerializer,
)
from .services import InventoryService, InvoiceProcessingService, AuditService, get_low_stock_items
from invoices.models import Invoice
from monaysolutions.config import API_MAX_PAGE_SIZE, LOW_STOCK_PAGE_SIZE
from monaysolutions.module_access import HasModuleAccess

logger = logging.getLogger(__name__)


class LowStockPagination(PageNumberPagination):
    """Pagination for low stock items."""
    page_size = LOW_STOCK_PAGE_SIZE
    page_size_query_param = 'page_size'
    max_page_size = API_MAX_PAGE_SIZE


class ProviderInventoryViewSet(viewsets.ModelViewSet):
    """ViewSet para ProviderInventory."""
    queryset = ProviderInventory.objects.all()
    serializer_class = ProviderInventorySerializer
    permission_classes = [permissions.IsAuthenticated, HasModuleAccess]
    http_method_names = ['get', 'patch', 'head', 'options']  # no POST/PUT/DELETE

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ProviderInventoryDetailSerializer
        return ProviderInventorySerializer

    def partial_update(self, request, *args, **kwargs):
        """PATCH — permite actualizar minimum_stock y markup_percentage."""
        allowed_fields = {'minimum_stock', 'markup_percentage'}
        data = {k: v for k, v in request.data.items() if k in allowed_fields}
        if not data:
            return Response(
                {'detail': 'Solo se puede actualizar minimum_stock o markup_percentage.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        kwargs['partial'] = True
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def search(self, request):
        product_name = request.data.get('product_name', '').strip()
        provider_id = request.data.get('provider_id')
        limit = int(request.data.get('limit', 20))
        offset = int(request.data.get('offset', 0))
        try:
            result = InventoryService.search(
                product_name=product_name,
                provider_id=provider_id,
                limit=limit,
                offset=offset,
            )
            return Response(result)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def process_invoice(self, request):
        invoice_id = request.data.get('invoice_id')
        if not invoice_id:
            return Response({'error': 'invoice_id es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            Invoice.objects.get(id=invoice_id)
            result = InvoiceProcessingService.process_invoice(invoice_id)
            return Response(result)
        except Invoice.DoesNotExist:
            return Response({'error': 'Factura no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error procesando factura: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AuditLogView(APIView):
    """View para consultar logs de auditoría."""
    permission_classes = [permissions.IsAuthenticated, HasModuleAccess]

    def get(self, request):
        try:
            result = AuditService.query_audit_logs(
                user_id=request.query_params.get('user_id'),
                product_name=request.query_params.get('product_name'),
                provider_id=request.query_params.get('provider_id'),
                start_date=request.query_params.get('start_date'),
                end_date=request.query_params.get('end_date'),
                limit=int(request.query_params.get('limit', 100)),
                offset=int(request.query_params.get('offset', 0)),
            )
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LowStockListView(APIView):
    """View para listar ítems con stock bajo."""
    permission_classes = [permissions.IsAuthenticated, HasModuleAccess]
    pagination_class = LowStockPagination

    def get(self, request):
        try:
            queryset = get_low_stock_items()
            
            # Apply pagination
            paginator = self.pagination_class()
            paginated_queryset = paginator.paginate_queryset(queryset, request)
            
            # Serialize the data
            serializer = LowStockItemSerializer(paginated_queryset, many=True)
            
            # Return paginated response
            return paginator.get_paginated_response(serializer.data)
        except Exception as e:
            logger.error(f"Error fetching low stock items: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LowStockCountView(APIView):
    """View para obtener el conteo de ítems con stock bajo."""
    permission_classes = [permissions.IsAuthenticated, HasModuleAccess]

    def get(self, request):
        try:
            count = get_low_stock_items().count()
            return Response({'count': count})
        except Exception as e:
            logger.error(f"Error counting low stock items: {e}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
