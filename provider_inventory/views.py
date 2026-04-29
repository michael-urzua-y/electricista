"""
API Views para provider_inventory.
"""
import logging
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ProviderInventory
from .serializers import ProviderInventorySerializer, ProviderInventoryDetailSerializer
from .services import InventoryService, InvoiceProcessingService, AuditService
from invoices.models import Invoice

logger = logging.getLogger(__name__)


class ProviderInventoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para ProviderInventory."""
    queryset = ProviderInventory.objects.all()
    serializer_class = ProviderInventorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ProviderInventoryDetailSerializer
        return ProviderInventorySerializer

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
    permission_classes = [permissions.IsAuthenticated]

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
