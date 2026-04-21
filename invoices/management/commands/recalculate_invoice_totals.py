#!/usr/bin/env python
import sys
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricista.settings')

import django
django.setup()

from django.core.management.base import BaseCommand
from django.db.models import Sum
from invoices.models import Invoice, InvoiceItem
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Recalcula total_amount de facturas basándose en la suma de ítems'

    def handle(self, *args, **options):
        invoices = Invoice.objects.all()
        updated = 0
        errors = 0

        self.stdout.write(f"Procesando {invoices.count()} facturas...")

        for invoice in invoices:
            try:
                total = invoice.items.aggregate(total=Sum('total_price'))['total'] or 0
                invoice.total_amount = total
                invoice.save(update_fields=['total_amount'])
                updated += 1
                self.stdout.write(f"✓ Factura #{invoice.id}: total_amount = {total}")
            except Exception as e:
                errors += 1
                self.stderr.write(f"✗ Factura #{invoice.id}: error - {e}")

        self.stdout.write(self.style.SUCCESS(f"\n✅ {updated} facturas actualizadas"))
        if errors:
            self.stderr.write(self.style.ERROR(f"❌ {errors} errores"))
