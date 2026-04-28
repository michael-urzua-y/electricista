from celery import shared_task
from .services import process_invoice
import logging
import sentry_sdk

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3)
def process_invoice_task(self, invoice_id):
    """
    Tarea de Celery para procesar la factura en segundo plano.
    Con reintentos automáticos y reporte a Sentry.
    """
    try:
        logger.info(f"[CELERY] Procesando factura {invoice_id}")
        result = process_invoice(invoice_id)
        logger.info(f"[CELERY] Factura {invoice_id} procesada exitosamente")
        return result
    
    except Exception as exc:
        logger.error(f"[CELERY] Error procesando factura {invoice_id}: {exc}")
        
        # Capturar en Sentry
        sentry_sdk.capture_exception(exc)
        
        # Reintentar en 60 segundos (máximo 3 veces)
        try:
            self.retry(exc=exc, countdown=60)
        except self.MaxRetriesExceededError:
            logger.critical(f"[CELERY] Factura {invoice_id} falló después de 3 reintentos")
            # Marcar factura como fallida
            from invoices.models import Invoice
            Invoice.objects.filter(id=invoice_id).update(
                status='failed',
                processing_notes='Error en procesamiento después de 3 reintentos'
            )
            sentry_sdk.capture_message(
                f"Invoice {invoice_id} failed after 3 retries",
                level="error"
            )