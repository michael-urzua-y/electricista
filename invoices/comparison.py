"""
Utilidades de comparación de facturas.
"""
from typing import Optional
from .models import Invoice


def obtener_factura_anterior(factura: Invoice) -> Optional[Invoice]:
    """
    Encuentra la factura completada más reciente del mismo proveedor y usuario
    con fecha de emisión estrictamente anterior a la factura dada.
    """
    if not factura.provider_id or not factura.issue_date:
        return None

    return (
        Invoice.objects.filter(
            provider_id=factura.provider_id,
            user_id=factura.user_id,
            status='completed',
            issue_date__lt=factura.issue_date,
        )
        .order_by('-issue_date')
        .first()
    )
