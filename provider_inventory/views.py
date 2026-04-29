"""
API Views para provider_inventory.
"""
import logging
from decimal import Decimal
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ProviderInventory, StockReservation
from .serializers import (
    ProviderInventorySerializer,
    ProviderInventoryDetailSerializer,
    StockReservationSerializer,
)
from .services import (
    InventoryService,
    InvoiceProcessingService,
    StockReservationService,
    AuditService,
)
from invoices.models import Invoice

logger = logging.getLogger(__name__)


class ProviderInventoryViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para ProviderInventory."""
    queryset = ProviderInventory.objects.all()
    serializer_class = ProviderInventorySerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        """Usa serializer detallado para retrieve."""
        if self.action == 'retrieve':
            return ProviderInventoryDetailSerializer
        return ProviderInventorySerializer
    
    @action(detail=False, methods=['post'])
    def search(self, request):
        """
        Busca productos en el inventario.
        
        Request:
        {
            "product_name": "cable",
            "provider_id": null,
            "limit": 20,
            "offset": 0
        }
        """
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
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
    
    @action(detail=False, methods=['post'])
    def add_to_quote(self, request):
        """
        Agrega un producto a una cotización.
        
        Request:
        {
            "quote_id": 5,
            "inventory_id": 123,
            "quantity": 50.0
        }
        """
        quote_id = request.data.get('quote_id')
        inventory_id = request.data.get('inventory_id')
        quantity = request.data.get('quantity')
        
        if not all([quote_id, inventory_id, quantity]):
            return Response(
                {'error': 'Faltan parámetros requeridos'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        try:
            quantity = Decimal(str(quantity))
            reservation = InventoryService.add_to_quote(
                quote_id=quote_id,
                inventory_id=inventory_id,
                quantity=quantity,
                user=request.user,
            )
            serializer = StockReservationSerializer(reservation)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(f"Error agregando a cotización: {e}")
            return Response(
                {'error': 'Error interno del servidor'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    
    @action(detail=False, methods=['post'])
    def remove_from_quote(self, request):
        """
        Remueve un producto de una cotización.
        
        Request:
        {
            "quote_item_id": 456
        }
        """
        quote_item_id = request.data.get('quote_item_id')
        
        if not quote_item_id:
            return Response(
                {'error': 'quote_item_id es requerido'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        try:
            quantity_restored = InventoryService.remove_from_quote(
                quote_item_id=quote_item_id,
                user=request.user,
            )
            return Response({
                'message': 'Stock restaurado',
                'quantity_restored': float(quantity_restored),
            })
        except Exception as e:
            logger.error(f"Error removiendo de cotización: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    
    @action(detail=False, methods=['post'])
    def process_invoice(self, request):
        """
        Procesa una factura e incrementa el inventario.
        
        Request:
        {
            "invoice_id": 789
        }
        """
        invoice_id = request.data.get('invoice_id')
        
        if not invoice_id:
            return Response(
                {'error': 'invoice_id es requerido'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        try:
            # Verificar que la factura existe
            invoice = Invoice.objects.get(id=invoice_id)
            
            # Procesar
            result = InvoiceProcessingService.process_invoice(invoice_id)
            
            return Response(result)
        except Invoice.DoesNotExist:
            return Response(
                {'error': 'Factura no encontrada'},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            logger.error(f"Error procesando factura: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AuditLogView(APIView):
    """View para consultar logs de auditoría."""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """
        Consulta logs de auditoría.
        
        Query params:
        - user_id: Filtrar por usuario
        - product_name: Filtrar por nombre de producto
        - provider_id: Filtrar por proveedor
        - start_date: Fecha inicio (ISO format)
        - end_date: Fecha fin (ISO format)
        - limit: Número máximo de resultados (default: 100)
        - offset: Desplazamiento (default: 0)
        """
        user_id = request.query_params.get('user_id')
        product_name = request.query_params.get('product_name')
        provider_id = request.query_params.get('provider_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        limit = int(request.query_params.get('limit', 100))
        offset = int(request.query_params.get('offset', 0))
        
        try:
            result = AuditService.query_audit_logs(
                user_id=user_id,
                product_name=product_name,
                provider_id=provider_id,
                start_date=start_date,
                end_date=end_date,
                limit=limit,
                offset=offset,
            )
            return Response(result)
        except Exception as e:
            logger.error(f"Error consultando logs: {e}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
