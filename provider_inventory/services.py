"""
Servicios para gestión de inventario por proveedor.
"""
import logging
from decimal import Decimal
from typing import Optional, List, Dict, Any
from django.db import transaction
from django.db.models import Q, F
from django.utils import timezone

from .models import (
    ProviderInventory,
    ProviderInventoryAuditLog,
    StockReservation,
    ProviderInventoryPriceHistory,
)
from quotes.models import Quote, QuoteItem
from invoices.models import Invoice, InvoiceItem

logger = logging.getLogger(__name__)


class InventoryService:
    """Servicio para gestionar búsqueda y modificación de inventario."""
    
    @staticmethod
    def search(
        product_name: str,
        provider_id: Optional[int] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Busca productos en el inventario de proveedores.
        
        Args:
            product_name: Nombre del producto a buscar (mínimo 2 caracteres)
            provider_id: ID del proveedor (opcional)
            limit: Número máximo de resultados
            offset: Desplazamiento para paginación
            
        Returns:
            Dict con count, results, next, previous
        """
        if len(product_name) < 2:
            raise ValueError("product_name debe tener al menos 2 caracteres")
        
        # Filtrar por nombre (case-insensitive, partial match) y stock > 0
        query = ProviderInventory.objects.filter(
            product_name__icontains=product_name,
            stock_quantity__gt=0
        )
        
        if provider_id:
            query = query.filter(provider_id=provider_id)
        
        # Contar total
        total_count = query.count()
        
        # Ordenar por proveedor y aplicar paginación
        results = query.select_related('provider').order_by(
            'provider__name', 'product_name'
        )[offset:offset + limit]
        
        # Agrupar por proveedor
        grouped_results = {}
        for item in results:
            provider_name = item.provider.name
            if provider_name not in grouped_results:
                grouped_results[provider_name] = []
            
            grouped_results[provider_name].append({
                'id': item.id,
                'product_name': item.product_name,
                'provider': {
                    'id': item.provider.id,
                    'name': item.provider.name,
                },
                'stock_quantity': float(item.stock_quantity),
                'unit_price': float(item.unit_price) if item.unit_price else None,
                'unit_measure': item.unit_measure,
                'last_updated': item.last_updated.isoformat(),
            })
        
        # Convertir a lista manteniendo orden
        results_list = []
        for provider_name in sorted(grouped_results.keys()):
            results_list.extend(grouped_results[provider_name])
        
        return {
            'count': total_count,
            'results': results_list,
            'next': offset + limit if offset + limit < total_count else None,
            'previous': offset - limit if offset > 0 else None,
        }
    
    @staticmethod
    def validate_stock(inventory_id: int, requested_quantity: Decimal) -> bool:
        """
        Valida que hay stock suficiente.
        
        Args:
            inventory_id: ID del inventario
            requested_quantity: Cantidad solicitada
            
        Returns:
            True si hay stock suficiente
            
        Raises:
            ValueError si no hay stock suficiente
        """
        inventory = ProviderInventory.objects.get(id=inventory_id)
        
        if inventory.stock_quantity < requested_quantity:
            raise ValueError(
                f"Stock insuficiente. Disponible: {inventory.stock_quantity} "
                f"{inventory.unit_measure}"
            )
        
        return True
    
    @staticmethod
    @transaction.atomic
    def add_to_quote(
        quote_id: int,
        inventory_id: int,
        quantity: Decimal,
        user=None,
    ) -> StockReservation:
        """
        Agrega un producto a una cotización (decrementa stock).
        
        Args:
            quote_id: ID de la cotización
            inventory_id: ID del inventario
            quantity: Cantidad a agregar
            user: Usuario que realiza la acción
            
        Returns:
            StockReservation creado
            
        Raises:
            ValueError si no hay stock suficiente
        """
        # Usar pessimistic locking
        inventory = ProviderInventory.objects.select_for_update().get(id=inventory_id)
        quote = Quote.objects.get(id=quote_id)
        
        # Validar stock
        if inventory.stock_quantity < quantity:
            raise ValueError(
                f"Stock insuficiente. Disponible: {inventory.stock_quantity} "
                f"{inventory.unit_measure}"
            )
        
        # Decrementar stock
        quantity_before = inventory.stock_quantity
        inventory.stock_quantity -= quantity
        inventory.save()
        
        # Crear reserva
        quote_item = QuoteItem.objects.create(
            quote=quote,
            product_name=inventory.product_name,
            quantity=quantity,
            unit=inventory.unit_measure,
            unit_price=inventory.unit_price or Decimal('0'),
        )
        
        reservation = StockReservation.objects.create(
            quote=quote,
            quote_item=quote_item,
            inventory=inventory,
            quantity_reserved=quantity,
            status='reserved',
        )
        
        # Crear audit log
        ProviderInventoryAuditLog.objects.create(
            inventory=inventory,
            action='decrement',
            quantity_before=quantity_before,
            quantity_after=inventory.stock_quantity,
            quantity_changed=-quantity,
            source='quote',
            quote_id=quote_id,
            quote_item_id=quote_item.id,
            user=user,
        )
        
        logger.info(
            f"Stock decrementado: {inventory.product_name} "
            f"({inventory.provider.name}) - {quantity} {inventory.unit_measure}"
        )
        
        return reservation
    
    @staticmethod
    @transaction.atomic
    def remove_from_quote(quote_item_id: int, user=None) -> Decimal:
        """
        Remueve un producto de una cotización (restaura stock).
        
        Args:
            quote_item_id: ID del ítem de cotización
            user: Usuario que realiza la acción
            
        Returns:
            Cantidad restaurada
        """
        # Obtener la reserva
        reservation = StockReservation.objects.select_related(
            'inventory', 'quote_item'
        ).get(quote_item_id=quote_item_id)
        
        inventory = reservation.inventory
        quantity = reservation.quantity_reserved
        
        # Usar pessimistic locking
        inventory = ProviderInventory.objects.select_for_update().get(id=inventory.id)
        
        # Incrementar stock
        quantity_before = inventory.stock_quantity
        inventory.stock_quantity += quantity
        inventory.save()
        
        # Actualizar reserva
        reservation.status = 'cancelled'
        reservation.save()
        
        # Crear audit log
        ProviderInventoryAuditLog.objects.create(
            inventory=inventory,
            action='restore',
            quantity_before=quantity_before,
            quantity_after=inventory.stock_quantity,
            quantity_changed=quantity,
            source='quote',
            quote_id=reservation.quote_id,
            quote_item_id=quote_item_id,
            user=user,
        )
        
        logger.info(
            f"Stock restaurado: {inventory.product_name} "
            f"({inventory.provider.name}) - {quantity} {inventory.unit_measure}"
        )
        
        return quantity
    
    @staticmethod
    @transaction.atomic
    def adjust_quantity(
        quote_item_id: int,
        new_quantity: Decimal,
        user=None,
    ) -> Dict[str, Any]:
        """
        Ajusta la cantidad de un producto en una cotización.
        
        Args:
            quote_item_id: ID del ítem de cotización
            new_quantity: Nueva cantidad
            user: Usuario que realiza la acción
            
        Returns:
            Dict con información del ajuste
        """
        reservation = StockReservation.objects.select_related(
            'inventory', 'quote_item'
        ).get(quote_item_id=quote_item_id)
        
        inventory = reservation.inventory
        old_quantity = reservation.quantity_reserved
        difference = new_quantity - old_quantity
        
        # Usar pessimistic locking
        inventory = ProviderInventory.objects.select_for_update().get(id=inventory.id)
        
        # Validar stock si es incremento
        if difference > 0 and inventory.stock_quantity < difference:
            raise ValueError(
                f"Stock insuficiente para incrementar. Disponible: {inventory.stock_quantity}"
            )
        
        # Ajustar stock
        quantity_before = inventory.stock_quantity
        inventory.stock_quantity -= difference
        inventory.save()
        
        # Actualizar reserva
        reservation.quantity_reserved = new_quantity
        reservation.save()
        
        # Actualizar quote item
        quote_item = reservation.quote_item
        quote_item.quantity = new_quantity
        quote_item.save()
        
        # Crear audit log
        action = 'increment' if difference < 0 else 'decrement'
        ProviderInventoryAuditLog.objects.create(
            inventory=inventory,
            action='adjustment',
            quantity_before=quantity_before,
            quantity_after=inventory.stock_quantity,
            quantity_changed=-difference,
            source='quote',
            quote_id=reservation.quote_id,
            quote_item_id=quote_item_id,
            user=user,
        )
        
        logger.info(
            f"Stock ajustado: {inventory.product_name} "
            f"({inventory.provider.name}) - {difference:+} {inventory.unit_measure}"
        )
        
        return {
            'quantity_before': old_quantity,
            'quantity_after': new_quantity,
            'stock_adjusted': -difference,
        }


class InvoiceProcessingService:
    """Servicio para procesar facturas e incrementar inventario."""
    
    @staticmethod
    def process_invoice(invoice_id: int) -> Dict[str, Any]:
        """
        Procesa una factura e incrementa el inventario.
        
        Args:
            invoice_id: ID de la factura
            
        Returns:
            Dict con resultado del procesamiento
        """
        invoice = Invoice.objects.get(id=invoice_id)
        items = invoice.items.all()
        
        processed = []
        created = []
        failed = []
        
        with transaction.atomic():
            for item in items:
                try:
                    result = InvoiceProcessingService.process_invoice_item(
                        item, invoice
                    )
                    if result['status'] == 'matched':
                        processed.append(result)
                    elif result['status'] == 'created':
                        created.append(result)
                except Exception as e:
                    logger.error(f"Error procesando ítem {item.id}: {e}")
                    failed.append({
                        'invoice_item_id': item.id,
                        'error': str(e),
                    })
        
        return {
            'invoice_id': invoice_id,
            'items_processed': len(processed),
            'items_created': len(created),
            'items_failed': len(failed),
            'details': processed + created,
            'errors': failed,
        }
    
    @staticmethod
    @transaction.atomic
    def process_invoice_item(item: InvoiceItem, invoice: Invoice) -> Dict[str, Any]:
        """
        Procesa un ítem de factura.
        
        Args:
            item: InvoiceItem a procesar
            invoice: Invoice padre
            
        Returns:
            Dict con resultado del procesamiento
        """
        if not item.description or not item.quantity or not item.unit_price:
            raise ValueError("Ítem incompleto: falta descripción, cantidad o precio")
        
        if item.quantity <= 0:
            raise ValueError("Cantidad debe ser positiva")
        
        # Buscar o crear inventario
        inventory, created = ProviderInventory.objects.get_or_create(
            product_name=item.description[:500],
            provider_id=invoice.provider_id,
            defaults={
                'stock_quantity': Decimal('0'),
                'unit_measure': item.unit_measure or 'unidad',
            }
        )
        
        # Usar pessimistic locking
        inventory = ProviderInventory.objects.select_for_update().get(id=inventory.id)
        
        # Incrementar stock
        quantity_before = inventory.stock_quantity
        inventory.stock_quantity += item.quantity
        
        # Actualizar precio si es más reciente
        if item.unit_price and (not inventory.unit_price or item.unit_price > inventory.unit_price):
            inventory.unit_price = item.unit_price
        
        inventory.last_invoice_id = invoice.id
        inventory.save()
        
        # Crear price history
        if item.unit_price:
            ProviderInventoryPriceHistory.objects.create(
                inventory=inventory,
                unit_price=item.unit_price,
                source='invoice',
                invoice_id=invoice.id,
            )
        
        # Crear audit log
        ProviderInventoryAuditLog.objects.create(
            inventory=inventory,
            action='increment',
            quantity_before=quantity_before,
            quantity_after=inventory.stock_quantity,
            quantity_changed=item.quantity,
            source='invoice',
            invoice_id=invoice.id,
        )
        
        logger.info(
            f"Inventario {'creado' if created else 'actualizado'}: "
            f"{inventory.product_name} ({inventory.provider.name}) - "
            f"+{item.quantity} {inventory.unit_measure}"
        )
        
        return {
            'invoice_item_id': item.id,
            'product_name': item.description,
            'provider_id': invoice.provider_id,
            'quantity': float(item.quantity),
            'status': 'created' if created else 'matched',
            'inventory_id': inventory.id,
        }


class StockReservationService:
    """Servicio para gestionar reservas de stock."""
    
    @staticmethod
    def create_reservation(
        quote_id: int,
        quote_item_id: int,
        inventory_id: int,
        quantity: Decimal,
    ) -> StockReservation:
        """
        Crea una reserva de stock.
        
        Args:
            quote_id: ID de la cotización
            quote_item_id: ID del ítem de cotización
            inventory_id: ID del inventario
            quantity: Cantidad a reservar
            
        Returns:
            StockReservation creado
        """
        quote = Quote.objects.get(id=quote_id)
        quote_item = QuoteItem.objects.get(id=quote_item_id)
        inventory = ProviderInventory.objects.get(id=inventory_id)
        
        reservation = StockReservation.objects.create(
            quote=quote,
            quote_item=quote_item,
            inventory=inventory,
            quantity_reserved=quantity,
            status='reserved',
        )
        
        return reservation
    
    @staticmethod
    def update_reservation_status(
        reservation_id: int,
        status: str,
    ) -> StockReservation:
        """
        Actualiza el estado de una reserva.
        
        Args:
            reservation_id: ID de la reserva
            status: Nuevo estado (reserved, approved, rejected, cancelled)
            
        Returns:
            StockReservation actualizado
        """
        reservation = StockReservation.objects.get(id=reservation_id)
        reservation.status = status
        reservation.save()
        
        return reservation
    
    @staticmethod
    @transaction.atomic
    def restore_stock_on_cancellation(quote_id: int, user=None) -> int:
        """
        Restaura stock cuando una cotización es cancelada o rechazada.
        
        Args:
            quote_id: ID de la cotización
            user: Usuario que realiza la acción
            
        Returns:
            Número de items restaurados
        """
        reservations = StockReservation.objects.filter(
            quote_id=quote_id,
            status__in=['reserved', 'approved']
        ).select_related('inventory', 'quote_item')
        
        count = 0
        for reservation in reservations:
            inventory = reservation.inventory
            
            # Usar pessimistic locking
            inventory = ProviderInventory.objects.select_for_update().get(id=inventory.id)
            
            # Restaurar stock
            quantity_before = inventory.stock_quantity
            inventory.stock_quantity += reservation.quantity_reserved
            inventory.save()
            
            # Actualizar reserva
            reservation.status = 'cancelled'
            reservation.save()
            
            # Crear audit log
            ProviderInventoryAuditLog.objects.create(
                inventory=inventory,
                action='restore',
                quantity_before=quantity_before,
                quantity_after=inventory.stock_quantity,
                quantity_changed=reservation.quantity_reserved,
                source='quote',
                quote_id=quote_id,
                quote_item_id=reservation.quote_item_id,
                user=user,
            )
            
            count += 1
        
        logger.info(f"Stock restaurado para {count} items de cotización {quote_id}")
        
        return count


class AuditService:
    """Servicio para auditoría de cambios de inventario."""
    
    @staticmethod
    def log_stock_change(
        inventory_id: int,
        action: str,
        quantity_before: Decimal,
        quantity_after: Decimal,
        source: str,
        user=None,
        invoice_id: Optional[int] = None,
        quote_id: Optional[int] = None,
        quote_item_id: Optional[int] = None,
        notes: str = '',
    ) -> ProviderInventoryAuditLog:
        """
        Registra un cambio de stock.
        
        Args:
            inventory_id: ID del inventario
            action: Acción (increment, decrement, adjustment, restore, manual)
            quantity_before: Cantidad antes
            quantity_after: Cantidad después
            source: Origen (invoice, quote, manual, system)
            user: Usuario que realiza la acción
            invoice_id: ID de factura (opcional)
            quote_id: ID de cotización (opcional)
            quote_item_id: ID de ítem de cotización (opcional)
            notes: Notas adicionales
            
        Returns:
            ProviderInventoryAuditLog creado
        """
        inventory = ProviderInventory.objects.get(id=inventory_id)
        
        log = ProviderInventoryAuditLog.objects.create(
            inventory=inventory,
            action=action,
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            quantity_changed=quantity_after - quantity_before,
            source=source,
            user=user,
            invoice_id=invoice_id,
            quote_id=quote_id,
            quote_item_id=quote_item_id,
            notes=notes,
        )
        
        return log
    
    @staticmethod
    def query_audit_logs(
        user_id: Optional[int] = None,
        product_name: Optional[str] = None,
        provider_id: Optional[int] = None,
        start_date=None,
        end_date=None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Consulta logs de auditoría con filtros.
        
        Args:
            user_id: Filtrar por usuario
            product_name: Filtrar por nombre de producto
            provider_id: Filtrar por proveedor
            start_date: Fecha inicio
            end_date: Fecha fin
            limit: Número máximo de resultados
            offset: Desplazamiento
            
        Returns:
            Dict con count y results
        """
        query = ProviderInventoryAuditLog.objects.all()
        
        if user_id:
            query = query.filter(user_id=user_id)
        
        if product_name:
            query = query.filter(inventory__product_name__icontains=product_name)
        
        if provider_id:
            query = query.filter(inventory__provider_id=provider_id)
        
        if start_date:
            query = query.filter(timestamp__gte=start_date)
        
        if end_date:
            query = query.filter(timestamp__lte=end_date)
        
        total_count = query.count()
        
        results = query.select_related(
            'inventory', 'user', 'inventory__provider'
        ).order_by('-timestamp')[offset:offset + limit]
        
        return {
            'count': total_count,
            'results': [
                {
                    'id': log.id,
                    'action': log.action,
                    'product_name': log.inventory.product_name,
                    'provider_name': log.inventory.provider.name,
                    'quantity_before': float(log.quantity_before),
                    'quantity_after': float(log.quantity_after),
                    'quantity_changed': float(log.quantity_changed),
                    'source': log.source,
                    'user': log.user.username if log.user else None,
                    'timestamp': log.timestamp.isoformat(),
                }
                for log in results
            ],
            'next': offset + limit if offset + limit < total_count else None,
            'previous': offset - limit if offset > 0 else None,
        }
