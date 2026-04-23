#!/usr/bin/env python
"""Crea PriceHistory para todos los InvoiceItems que no lo tienen."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricista.settings')

import django
django.setup()

from invoices.models import InvoiceItem
from products.models import PriceHistory

items = (
    InvoiceItem.objects
    .filter(product__isnull=False, unit_price__isnull=False, invoice__status='completed')
    .select_related('product', 'invoice__provider')
)

created_count = 0
for item in items:
    provider = item.invoice.provider
    if not provider:
        continue
    exists = PriceHistory.objects.filter(
        product=item.product,
        provider=provider,
        price=item.unit_price,
    ).exists()
    if not exists:
        PriceHistory.objects.create(
            product=item.product,
            provider=provider,
            price=item.unit_price,
            currency=item.invoice.currency or 'CLP',
        )
        created_count += 1
        print(f"  {item.product.name[:50]} @ ${int(item.unit_price):,} -> {provider.name}")

print(f"\nCreados: {created_count} registros de PriceHistory")
print(f"Total PriceHistory: {PriceHistory.objects.count()}")
