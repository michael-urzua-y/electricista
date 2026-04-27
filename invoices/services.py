import re
import logging
from django.db import transaction
from .models import Invoice, InvoiceItem
from products.models import Product, PriceHistory
from .ocr import OCRProcessor
from .ai_parser import InvoiceAIParser
from thefuzz import process as fuzz_process

logger = logging.getLogger(__name__)

# Umbral de similitud para fuzzy matching.
# 92% evita que productos con medidas distintas (ej: 0.60 vs 0.70) se fusionen.
FUZZY_MATCH_THRESHOLD = 92

# Patrón para extraer dimensiones/medidas del nombre del producto.
# Si dos nombres difieren en sus medidas, NO se consideran el mismo producto.
_DIMENSIONS_RE = re.compile(r'\d+[.,]?\d*\s*[xX×]\s*\d+[.,]?\d*|\d+[.,]\d+|\d+\s*[mMkKgGlL]{1,3}\b')


def _extract_dimensions(name: str) -> frozenset:
    """Extrae todas las medidas/dimensiones de un nombre de producto."""
    return frozenset(_DIMENSIONS_RE.findall(name.upper()))


def _find_matching_product(desc: str, provider_id) -> Product | None:
    """
    Busca un producto existente para la descripción dada.

    Estrategia:
    1. Búsqueda exacta (case-insensitive).
    2. Fuzzy matching con umbral alto (FUZZY_MATCH_THRESHOLD).
       - Rechaza el match si las dimensiones del nombre difieren,
         para evitar fusionar "PUERTA 0.60x2.00" con "PUERTA 0.70x2.00".
    3. Si no hay match, retorna None (el caller crea el producto).
    """
    desc_truncated = desc[:200]

    # 1. Búsqueda exacta
    product = Product.objects.filter(name__iexact=desc_truncated, is_active=True).first()
    if product:
        return product

    # 2. Fuzzy matching — solo contra productos del mismo proveedor primero,
    #    luego contra todos si no hay resultado.
    for qs_filter in [
        {'is_active': True, 'price_history__provider_id': provider_id},
        {'is_active': True},
    ]:
        existing = Product.objects.filter(**qs_filter).values('id', 'name').distinct()
        if not existing:
            continue

        choices = {p['id']: p['name'] for p in existing}
        best_match = fuzz_process.extractOne(desc_truncated, choices)

        if not best_match or best_match[1] < FUZZY_MATCH_THRESHOLD:
            continue

        matched_name = best_match[0]
        # Rechazar si las dimensiones difieren (ej: 0.60x2.00 ≠ 0.70x2.00)
        if _extract_dimensions(desc_truncated) != _extract_dimensions(matched_name):
            logger.info(
                "Fuzzy match rechazado por dimensiones distintas: "
                "'%s' vs '%s' (score=%s)", desc, matched_name, best_match[1]
            )
            continue

        product = Product.objects.get(id=best_match[2])
        logger.info(
            "Fuzzy match aceptado: '%s' → '%s' (score=%s)",
            desc, product.name, best_match[1]
        )
        return product

    return None


def _process_items(invoice: Invoice, items_data: list) -> float:
    """Crea InvoiceItems y PriceHistory para cada ítem parseado. Retorna el total."""
    total_amount = 0.0

    for item_data in items_data:
        desc = item_data.get('description', '')
        quantity = item_data.get('quantity', 1) or 1
        unit_price = item_data.get('unit_price')
        total_price = item_data.get('total_price')
        category = item_data.get('category', 'general')

        # Calcular precio faltante
        if unit_price is None and total_price is not None:
            unit_price = float(total_price) / float(quantity) if quantity else 0.0
        if total_price is None and unit_price is not None:
            total_price = float(unit_price) * float(quantity)

        total_amount += total_price or 0

        # Resolver producto
        product = None
        if desc:
            product = _find_matching_product(desc, invoice.provider_id)
            if not product:
                product = Product.objects.create(
                    name=desc[:200],
                    provider=None,
                    category=category.lower().strip()[:50],
                    is_active=True,
                )

        InvoiceItem.objects.create(
            invoice=invoice,
            product=product,
            description=desc,
            quantity=quantity,
            unit_price=unit_price,
            total_price=total_price,
            unit_measure=item_data.get('unit_measure'),
            needs_review=product is None,
            markup_percentage=invoice.markup_percentage,
        )

        if product and unit_price:
            PriceHistory.objects.create(
                product=product,
                provider=invoice.provider,
                price=unit_price,
                currency=invoice.currency,
            )

    return total_amount


def process_invoice(invoice_id: int) -> None:
    """
    Servicio principal para procesar una factura:
    1. OCR del archivo
    2. Parseo con IA (Mistral)
    3. Creación de InvoiceItems y PriceHistory
    4. Actualización del total y estado
    """
    invoice = Invoice.objects.get(id=invoice_id)
    invoice.status = 'processing'
    invoice.save()

    try:
        # 1. OCR
        ocr_processor = OCRProcessor()
        file_path = invoice.file.path
        file_type = invoice.file_type or file_path.split('.')[-1].lower()
        invoice.ocr_text = ocr_processor.extract_text(file_path=file_path, file_type=file_type)

        # 2. Parseo IA
        parsed_data = InvoiceAIParser().parse(invoice.ocr_text)

        # 3. Persistir ítems
        with transaction.atomic():
            total_amount = _process_items(invoice, parsed_data.get('items', []))
            invoice.total_amount = total_amount
            invoice.status = 'completed'
            invoice.save()

    except Exception as e:
        logger.error("Error procesando factura %s: %s", invoice_id, e, exc_info=True)
        invoice.status = 'failed'
        invoice.processing_notes = str(e)
        invoice.save()
        raise