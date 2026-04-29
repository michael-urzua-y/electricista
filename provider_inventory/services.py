"""
Servicios para gestión de inventario por proveedor.
"""
import logging
from decimal import Decimal
from typing import Optional, Dict, Any
from django.db import transaction

from .models import ProviderInventory, ProviderInventoryAuditLog
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
        if len(product_name) < 2:
            raise ValueError("product_name debe tener al menos 2 caracteres")

        query = ProviderInventory.objects.filter(
            product_name__icontains=product_name,
            stock_quantity__gt=0
        )
        if provider_id:
            query = query.filter(provider_id=provider_id)

        total_count = query.count()
        results = query.select_related('provider').order_by(
            'provider__name', 'product_name'
        )[offset:offset + limit]

        grouped = {}
        for item in results:
            pname = item.provider.name
            if pname not in grouped:
                grouped[pname] = []
            grouped[pname].append({
                'id': item.id,
                'product_name': item.product_name,
                'provider': {'id': item.provider.id, 'name': item.provider.name},
                'stock_quantity': float(item.stock_quantity),
                'unit_price': float(item.unit_price) if item.unit_price else None,
                'unit_measure': item.unit_measure,
                'last_updated': item.last_updated.isoformat(),
            })

        results_list = []
        for pname in sorted(grouped.keys()):
            results_list.extend(grouped[pname])

        return {
            'count': total_count,
            'results': results_list,
            'next': offset + limit if offset + limit < total_count else None,
            'previous': offset - limit if offset > 0 else None,
        }

    @staticmethod
    def validate_stock(inventory_id: int, requested_quantity: Decimal) -> bool:
        inventory = ProviderInventory.objects.get(id=inventory_id)
        if inventory.stock_quantity < requested_quantity:
            raise ValueError(
                f"Stock insuficiente. Disponible: {inventory.stock_quantity} {inventory.unit_measure}"
            )
        return True


class InvoiceProcessingService:
    """Servicio para procesar facturas e incrementar inventario."""

    @staticmethod
    def process_invoice(invoice_id: int) -> Dict[str, Any]:
        invoice = Invoice.objects.get(id=invoice_id)
        processed, created_list, failed = [], [], []

        with transaction.atomic():
            for item in invoice.items.all():
                try:
                    result = InvoiceProcessingService.process_invoice_item(item, invoice)
                    if result['status'] == 'matched':
                        processed.append(result)
                    else:
                        created_list.append(result)
                except Exception as e:
                    logger.error(f"Error procesando ítem {item.id}: {e}")
                    failed.append({'invoice_item_id': item.id, 'error': str(e)})

        return {
            'invoice_id': invoice_id,
            'items_processed': len(processed),
            'items_created': len(created_list),
            'items_failed': len(failed),
            'details': processed + created_list,
            'errors': failed,
        }

    @staticmethod
    @transaction.atomic
    def process_invoice_item(item: InvoiceItem, invoice: Invoice) -> Dict[str, Any]:
        if not item.description or not item.quantity or not item.unit_price:
            raise ValueError("Ítem incompleto: falta descripción, cantidad o precio")
        if item.quantity <= 0:
            raise ValueError("Cantidad debe ser positiva")

        inventory, is_new = ProviderInventory.objects.get_or_create(
            product_name=item.description[:500],
            provider_id=invoice.provider_id,
            defaults={
                'stock_quantity': Decimal('0'),
                'unit_measure': item.unit_measure or 'unidad',
            }
        )

        inventory = ProviderInventory.objects.select_for_update().get(id=inventory.id)
        quantity_before = inventory.stock_quantity
        inventory.stock_quantity += item.quantity

        if item.unit_price and (not inventory.unit_price or item.unit_price > inventory.unit_price):
            inventory.unit_price = item.unit_price

        inventory.last_invoice_id = invoice.id
        inventory.save()

        ProviderInventoryAuditLog.objects.create(
            inventory=inventory,
            action='increment',
            quantity_before=quantity_before,
            quantity_after=inventory.stock_quantity,
            quantity_changed=item.quantity,
            source='invoice',
            invoice_id=invoice.id,
        )

        return {
            'invoice_item_id': item.id,
            'product_name': item.description,
            'provider_id': invoice.provider_id,
            'quantity': float(item.quantity),
            'status': 'created' if is_new else 'matched',
            'inventory_id': inventory.id,
        }


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
        inventory = ProviderInventory.objects.get(id=inventory_id)
        return ProviderInventoryAuditLog.objects.create(
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
        results = query.select_related('inventory', 'user', 'inventory__provider').order_by(
            '-timestamp'
        )[offset:offset + limit]

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
