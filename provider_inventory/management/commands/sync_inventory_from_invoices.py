"""
Management command para poblar ProviderInventory desde facturas completadas existentes.
Útil para inicializar el inventario cuando ya hay facturas en el sistema.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal

from invoices.models import Invoice
from provider_inventory.models import ProviderInventory, ProviderInventoryAuditLog


class Command(BaseCommand):
    help = 'Sincroniza ProviderInventory desde todas las facturas completadas existentes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Borra todo el inventario antes de sincronizar',
        )

    def handle(self, *args, **options):
        if options['reset']:
            count = ProviderInventory.objects.count()
            ProviderInventory.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Inventario reseteado: {count} registros eliminados'))

        invoices = Invoice.objects.filter(
            status='completed',
            provider__isnull=False,
        ).prefetch_related('items').order_by('issue_date', 'id')

        total_invoices = invoices.count()
        self.stdout.write(f'Procesando {total_invoices} facturas completadas...')

        created = updated = skipped = 0

        for invoice in invoices:
            for item in invoice.items.all():
                if not item.description or not item.quantity or item.quantity <= 0:
                    skipped += 1
                    continue

                try:
                    with transaction.atomic():
                        inventory, is_new = ProviderInventory.objects.get_or_create(
                            product_name=item.description[:500],
                            provider=invoice.provider,
                            defaults={
                                'stock_quantity': Decimal('0'),
                                'unit_measure': item.unit_measure or 'unidad',
                                'unit_price': item.unit_price,
                            }
                        )

                        quantity_before = inventory.stock_quantity
                        inventory.stock_quantity += item.quantity

                        if item.unit_price and (
                            inventory.unit_price is None or
                            item.unit_price > inventory.unit_price
                        ):
                            inventory.unit_price = item.unit_price

                        inventory.last_invoice_id = invoice.id
                        inventory.save()

                        ProviderInventoryAuditLog.objects.create(
                            inventory=inventory,
                            action='increment',
                            quantity_before=quantity_before,
                            quantity_after=inventory.stock_quantity,
                            quantity_changed=item.quantity,
                            source='invoice',
                            invoice_id=invoice.id,
                        )

                        if is_new:
                            created += 1
                        else:
                            updated += 1

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'  Error en item {item.id} ({item.description[:40]}): {e}')
                    )
                    skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f'\n✅ Sincronización completada:'
            f'\n   Nuevos registros: {created}'
            f'\n   Actualizados:     {updated}'
            f'\n   Omitidos:         {skipped}'
        ))
        self.stdout.write(f'\n📦 Total en ProviderInventory: {ProviderInventory.objects.count()} registros')
