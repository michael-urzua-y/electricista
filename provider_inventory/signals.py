"""
Signals para provider_inventory.
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver
from invoices.models import Invoice
from .services import InvoiceProcessingService

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Invoice)
def process_invoice_on_completion(sender, instance, created, update_fields=None, **kwargs):
    """
    Procesa una factura automáticamente cuando su estado cambia a 'completed'.
    """
    # Evitar recursión infinita: no procesar si solo se está actualizando processing_notes
    if update_fields and 'processing_notes' in update_fields and len(update_fields) == 1:
        return
    
    if instance.status == 'completed' and not created:
        try:
            logger.info(f"Procesando factura {instance.id} automáticamente")
            result = InvoiceProcessingService.process_invoice(instance.id)
            # Usar update() en lugar de save() para evitar disparar el signal nuevamente
            Invoice.objects.filter(id=instance.id).update(
                processing_notes=f"Procesada automáticamente: {result['items_processed']} items"
            )
        except Exception as e:
            logger.error(f"Error procesando factura {instance.id}: {e}")
            # Usar update() en lugar de save() para evitar disparar el signal nuevamente
            Invoice.objects.filter(id=instance.id).update(
                processing_notes=f"Error: {str(e)}"
            )
