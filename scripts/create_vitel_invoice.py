#!/usr/bin/env python
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricista.settings')

import django
django.setup()

from invoices.models import Invoice, InvoiceItem
from products.models import Product, Provider
from django.contrib.auth import get_user_model
from decimal import Decimal
from datetime import date

User = get_user_model()
user = User.objects.get(username='demo')

vitel, created = Provider.objects.get_or_create(
    name='Vitel Energia',
    defaults={'category': 'electricidad', 'is_active': True, 'website': 'https://vitelenergia.com'}
)
print(f"Proveedor: {vitel.name} (ID:{vitel.id})")

productos_data = [
    ('Alambre Concentrico 2x4mm2 BAKER KABEL', 'BAKER KABEL', 1508),
    ('Cable Libre Halogeno 2.5mm2 RZ1-K REVI', 'REVI', 764),
    ('Cable Libre Halogeno 1.5mm2 H07Z1-K REVI', 'REVI', 232),
    ('Cable Libre Halogeno 2.5mm2 Rollo 100m REVI', 'REVI', 40427),
    ('Cable Flexible RV-K 3x1.5mm2 REVI', 'REVI', 1178),
    ('Cable Aluminio Preensamblado 2x16mm2 BAKER KABEL', 'BAKER KABEL', 629),
    ('Plafon Circle LED 6W 4000K 120mm VTEC', 'VTEC', 2548),
    ('Campana LED UFO Saturn III 200W VTEC', 'VTEC', 74781),
    ('Foco Estaca Solar Jardin 2W VTEC', 'VTEC', 15756),
    ('Foco Sobrepuesto Rectangular GU10 Negro VTEC', 'VTEC', 13205),
]

random.seed(42)
productos = []
for name, brand, price in productos_data:
    prod, _ = Product.objects.get_or_create(
        name=name,
        defaults={'brand': brand, 'category': 'electricidad', 'provider': vitel}
    )
    productos.append((prod, price))
    print(f"  Producto: {name} (ID:{prod.id})")

cantidades = [random.randint(1, 25) for _ in range(10)]
total = sum(cantidades[i] * productos_data[i][2] for i in range(10))

inv, created = Invoice.objects.get_or_create(
    invoice_number='VIT-2026-0423',
    defaults={
        'user': user,
        'provider': vitel,
        'issue_date': date(2026, 4, 23),
        'status': 'completed',
        'total_amount': Decimal(str(total)),
        'currency': 'CLP',
    }
)

if created:
    for i, (prod, base_price) in enumerate(productos):
        qty = cantidades[i]
        up = Decimal(str(base_price))
        tp = up * qty
        InvoiceItem.objects.create(
            invoice=inv, product=prod, description=prod.name,
            quantity=qty, unit_price=up, total_price=tp,
        )
    print(f"\nFactura creada: #{inv.invoice_number} - {inv.issue_date}")
    print(f"Proveedor: {vitel.name} - Total: ${total:,}")
    for item in inv.items.all():
        print(f"  {int(item.quantity)}x {item.description} @ ${int(item.unit_price):,} = ${int(item.total_price):,}")
else:
    print(f"Factura ya existia: #{inv.invoice_number}")
