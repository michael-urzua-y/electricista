#!/usr/bin/env python
"""Crea una factura de Vitel con algunos productos que ya existen en Gobantes para comparar entre proveedores."""
import os, sys
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
vitel = Provider.objects.get(name='Vitel Energia')
gobantes = Provider.objects.get(name='Gobantes')

# Productos que ya existen en Gobantes (IDs 1-5)
cable = Product.objects.get(id=1)       # CABLE ARA-Z1 2.5mm2
clavija_3p = Product.objects.get(id=2)  # CLAVIJA MACHO 3P+N+T
caja = Product.objects.get(id=3)        # CAJA B-15
interruptor = Product.objects.get(id=4) # DX3/INT 3X20A
clavija_2p = Product.objects.get(id=5)  # CLAVIJA MACHO 2P+T
tubo = Product.objects.get(id=6)        # TUBO CONDUIT PVC

# Crear factura de Vitel con esos mismos productos pero precios distintos
inv, created = Invoice.objects.get_or_create(
    invoice_number='VIT-2026-0420',
    defaults={
        'user': user,
        'provider': vitel,
        'issue_date': date(2026, 4, 20),
        'status': 'completed',
        'total_amount': Decimal('0'),
        'currency': 'CLP',
    }
)

if created:
    items_data = [
        (cable, 'CABLE ARA-Z1 2.5mm2 NEGRO 750V LIB/HAL.', 50, 138),
        (clavija_3p, 'CLAVIJA MACHO 3P+N+T 16A.380V. IDE 3103', 2, 7450),
        (caja, 'CAJA B-15 C/TAPA Y EMP. E.G. EKOLINE', 3, 3990),
        (interruptor, '407860 (EX 06489) DX3/INT 3X20A C 6-10KA', 1, 18200),
        (clavija_2p, 'CLAVIJA MACHO 2P+T 16A.220V.IDE 2101', 5, 2150),
        (tubo, 'TUBO CONDUIT PVC 20mm x 3m', 8, 1180),
    ]
    total = Decimal('0')
    for prod, desc, qty, price in items_data:
        up = Decimal(str(price))
        tp = up * qty
        total += tp
        InvoiceItem.objects.create(
            invoice=inv, product=prod, description=desc,
            quantity=qty, unit_price=up, total_price=tp,
        )
    inv.total_amount = total
    inv.save()
    print(f"Factura creada: #{inv.invoice_number} - {inv.issue_date} - Total: ${total:,}")
    for item in inv.items.all():
        print(f"  {int(item.quantity)}x {item.description} @ ${int(item.unit_price):,}")
else:
    print(f"Factura ya existia: #{inv.invoice_number}")

print("\nProductos compartidos entre Gobantes y Vitel:")
print("  CABLE ARA-Z1 2.5mm2: Gobantes $152 vs Vitel $138")
print("  CLAVIJA 3P+N+T: Gobantes $6,974 vs Vitel $7,450")
print("  CAJA B-15: Gobantes $4,338 vs Vitel $3,990")
print("  DX3/INT 3X20A: Gobantes $19,487 vs Vitel $18,200")
print("  CLAVIJA 2P+T: Gobantes $2,338 vs Vitel $2,150")
print("  TUBO CONDUIT: Gobantes N/A (solo abril 10) vs Vitel $1,180")
