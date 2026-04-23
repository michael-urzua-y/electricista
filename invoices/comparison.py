"""
Módulo de servicio de comparación de precios entre facturas.

Contiene funciones puras para la lógica de comparación de precios
entre facturas del mismo proveedor.
"""
from decimal import Decimal
from typing import Optional

from .models import Invoice, InvoiceItem


def calcular_variacion(precio_anterior: Decimal, precio_actual: Decimal) -> dict:
    """
    Calcula diferencia absoluta y porcentual entre dos precios.

    Args:
        precio_anterior: Precio unitario de la factura anterior.
        precio_actual: Precio unitario de la factura actual.

    Returns:
        dict con 'diferencia' y 'variacion_porcentual'.
        Si precio_anterior es 0, variacion_porcentual es None.
    """
    diferencia = precio_actual - precio_anterior
    if precio_anterior == 0:
        variacion_porcentual = None
    else:
        variacion_porcentual = (diferencia / precio_anterior) * Decimal('100')
    return {
        'diferencia': diferencia,
        'variacion_porcentual': variacion_porcentual,
    }


def obtener_factura_anterior(factura: Invoice) -> Optional[Invoice]:
    """
    Encuentra la factura completada más reciente del mismo proveedor y usuario
    con fecha de emisión estrictamente anterior a la factura dada.

    Args:
        factura: Instancia de Invoice actual.

    Returns:
        La factura anterior o None si no existe.
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


def calcular_comparacion(factura_actual: Invoice, factura_base: Invoice) -> dict:
    """
    Calcula la comparación de productos comunes entre dos facturas.

    Identifica productos comunes por product_id (no nulo) entre los ítems
    de ambas facturas y calcula la variación de precio para cada uno.

    Args:
        factura_actual: Factura actual (más reciente).
        factura_base: Factura base (anterior) para comparar.

    Returns:
        dict con metadatos de ambas facturas y lista de productos_comunes.
    """
    def _factura_meta(factura: Invoice) -> dict:
        return {
            'id': factura.id,
            'numero': factura.invoice_number,
            'fecha_emision': factura.issue_date,
            'proveedor': factura.provider.name if factura.provider else None,
        }

    # Obtener ítems con product_id no nulo, indexados por product_id
    items_base = {
        item.product_id: item
        for item in factura_base.items.select_related('product').all()
        if item.product_id is not None
    }
    items_actual = {
        item.product_id: item
        for item in factura_actual.items.select_related('product').all()
        if item.product_id is not None
    }

    # Intersección de product_ids
    common_ids = set(items_base.keys()) & set(items_actual.keys())

    productos_comunes = []
    for pid in common_ids:
        item_base = items_base[pid]
        item_actual = items_actual[pid]
        precio_anterior = item_base.unit_price or Decimal('0')
        precio_actual = item_actual.unit_price or Decimal('0')
        variacion = calcular_variacion(precio_anterior, precio_actual)
        productos_comunes.append({
            'producto_id': pid,
            'producto_nombre': item_actual.product.name if item_actual.product else item_actual.description,
            'precio_anterior': precio_anterior,
            'precio_actual': precio_actual,
            'diferencia': variacion['diferencia'],
            'variacion_porcentual': variacion['variacion_porcentual'],
        })

    mensaje = None
    if not productos_comunes:
        mensaje = 'No hay productos en común entre las facturas'

    return {
        'factura_actual': _factura_meta(factura_actual),
        'factura_anterior': _factura_meta(factura_base),
        'productos_comunes': productos_comunes,
        'mensaje': mensaje,
    }


def comparar_mes(proveedor_id: int, user, year: int, month: int) -> dict:
    """
    Calcula resumen mensual de precios para un proveedor.

    Obtiene todas las facturas completadas del proveedor y usuario en el período,
    y para cada producto que aparece en al menos 2 facturas calcula estadísticas.

    Args:
        proveedor_id: ID del proveedor.
        user: Usuario autenticado.
        year: Año del período.
        month: Mes del período.

    Returns:
        dict con lista de facturas del período y estadísticas por producto.
    """
    facturas = (
        Invoice.objects.filter(
            provider_id=proveedor_id,
            user=user,
            status='completed',
            issue_date__year=year,
            issue_date__month=month,
        )
        .order_by('issue_date')
        .select_related('provider')
    )

    facturas_list = list(facturas)

    if not facturas_list:
        from products.models import Provider
        try:
            proveedor = Provider.objects.get(id=proveedor_id)
            proveedor_nombre = proveedor.name
        except Provider.DoesNotExist:
            proveedor_nombre = str(proveedor_id)
        return {
            'proveedor': proveedor_nombre,
            'periodo': {'year': year, 'month': month},
            'facturas': [],
            'productos': [],
            'mensaje': 'No hay facturas de este proveedor en el período indicado',
        }

    proveedor_nombre = facturas_list[0].provider.name if facturas_list[0].provider else str(proveedor_id)

    facturas_meta = [
        {
            'id': f.id,
            'numero': f.invoice_number,
            'fecha_emision': f.issue_date,
        }
        for f in facturas_list
    ]

    # Collect all items with product_id, grouped by product
    # product_id -> list of (issue_date, unit_price)
    from collections import defaultdict
    product_data = defaultdict(list)
    product_names = {}
    factura_ids = [f.id for f in facturas_list]

    items = (
        InvoiceItem.objects.filter(
            invoice_id__in=factura_ids,
        )
        .exclude(product_id__isnull=True)
        .select_related('product', 'invoice')
        .order_by('invoice__issue_date')
    )

    for item in items:
        pid = item.product_id
        product_data[pid].append({
            'issue_date': item.invoice.issue_date,
            'unit_price': item.unit_price or Decimal('0'),
        })
        if pid not in product_names and item.product:
            product_names[pid] = item.product.name

    productos = []
    for pid, entries in product_data.items():
        if len(entries) < 2:
            continue

        prices = [e['unit_price'] for e in entries]
        precio_minimo = min(prices)
        precio_maximo = max(prices)
        precio_promedio = sum(prices) / len(prices)

        # Variation between first and last invoice of the period
        precio_primera = entries[0]['unit_price']
        precio_ultima = entries[-1]['unit_price']
        variacion = calcular_variacion(precio_primera, precio_ultima)

        productos.append({
            'producto_id': pid,
            'producto_nombre': product_names.get(pid, ''),
            'precio_minimo': precio_minimo,
            'precio_maximo': precio_maximo,
            'precio_promedio': precio_promedio,
            'variacion_porcentual': variacion['variacion_porcentual'],
        })

    return {
        'proveedor': proveedor_nombre,
        'periodo': {'year': year, 'month': month},
        'facturas': facturas_meta,
        'productos': productos,
        'mensaje': None,
    }
