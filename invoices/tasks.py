from celery import shared_task
from .services import process_invoice

@shared_task
def process_invoice_task(invoice_id):
    """
    Tarea de Celery para procesar la factura en segundo plano.
    """
    return process_invoice(invoice_id)