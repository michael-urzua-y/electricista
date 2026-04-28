import os
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from .models import Invoice, InvoiceItem
from django.db.models import Sum

import logging

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Invoice)
def set_file_type(sender, instance, **kwargs):
    """Auto-determinar tipo de archivo basado en extensión"""
    # El file_type ahora se determina en perform_create de views.py
    # Este signal ya no es necesario pero lo dejamos por compatibilidad
    pass


@receiver(post_save, sender=InvoiceItem)
@receiver(post_delete, sender=InvoiceItem)
def update_invoice_total(sender, instance, **kwargs):
    """Actualiza el total de la factura cuando se modifican sus ítems"""
    try:
        invoice = instance.invoice
        total = invoice.items.aggregate(total=Sum('total_price'))['total'] or 0
        invoice.total_amount = total
        invoice.save(update_fields=['total_amount'])
        logger.info(f"Total de factura #{invoice.id} actualizado: {total}")
    except Exception as e:
        logger.error(f"Error actualizando total de factura: {e}")
