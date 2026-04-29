# Generated migration for provider_inventory

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('products', '0002_add_stock_and_unit_choices'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('quotes', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProviderInventory',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('product_name', models.CharField(db_index=True, help_text='Nombre del producto tal como aparece en facturas', max_length=500, verbose_name='Nombre del producto')),
                ('stock_quantity', models.DecimalField(decimal_places=3, default=0, help_text='Cantidad disponible del producto', max_digits=12, verbose_name='Cantidad en stock')),
                ('unit_price', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True, verbose_name='Precio unitario', help_text='Precio más reciente del proveedor')),
                ('unit_measure', models.CharField(choices=[('unidad', 'Unidad'), ('metro', 'Metro'), ('rollo', 'Rollo'), ('caja', 'Caja'), ('kg', 'Kilogramo'), ('litro', 'Litro')], default='unidad', max_length=20, verbose_name='Unidad de medida')),
                ('last_updated', models.DateTimeField(auto_now=True, verbose_name='Última actualización')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Fecha creación')),
                ('last_invoice_id', models.BigIntegerField(blank=True, null=True, verbose_name='ID de última factura procesada')),
                ('provider', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inventory_items', to='products.provider', verbose_name='Proveedor')),
            ],
            options={
                'verbose_name': 'Inventario de Proveedor',
                'verbose_name_plural': 'Inventarios de Proveedores',
                'unique_together': {('product_name', 'provider')},
            },
        ),
        migrations.CreateModel(
            name='ProviderInventoryPriceHistory',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('unit_price', models.DecimalField(decimal_places=2, max_digits=12, verbose_name='Precio unitario')),
                ('source', models.CharField(choices=[('invoice', 'Factura'), ('manual', 'Manual')], max_length=20, verbose_name='Origen')),
                ('invoice_id', models.BigIntegerField(blank=True, null=True, verbose_name='ID Factura')),
                ('recorded_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Fecha registro')),
                ('inventory', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='price_history', to='provider_inventory.providerinventory', verbose_name='Inventario')),
            ],
            options={
                'verbose_name': 'Historial de Precio',
                'verbose_name_plural': 'Historiales de Precios',
                'ordering': ['-recorded_at'],
            },
        ),
        migrations.CreateModel(
            name='ProviderInventoryAuditLog',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('action', models.CharField(choices=[('increment', 'Incremento (Factura)'), ('decrement', 'Decremento (Cotización)'), ('adjustment', 'Ajuste (Modificación)'), ('restore', 'Restauración (Cancelación)'), ('manual', 'Manual (Usuario)')], max_length=20, verbose_name='Acción')),
                ('quantity_before', models.DecimalField(decimal_places=3, max_digits=12, verbose_name='Cantidad antes')),
                ('quantity_after', models.DecimalField(decimal_places=3, max_digits=12, verbose_name='Cantidad después')),
                ('quantity_changed', models.DecimalField(decimal_places=3, max_digits=12, verbose_name='Cantidad cambiada')),
                ('source', models.CharField(choices=[('invoice', 'Factura'), ('quote', 'Cotización'), ('manual', 'Manual'), ('system', 'Sistema')], max_length=20, verbose_name='Origen')),
                ('invoice_id', models.BigIntegerField(blank=True, null=True, verbose_name='ID Factura')),
                ('quote_id', models.BigIntegerField(blank=True, null=True, verbose_name='ID Cotización')),
                ('quote_item_id', models.BigIntegerField(blank=True, null=True, verbose_name='ID Ítem Cotización')),
                ('notes', models.TextField(blank=True, default='', verbose_name='Notas')),
                ('timestamp', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Timestamp')),
                ('inventory', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_logs', to='provider_inventory.providerinventory', verbose_name='Inventario')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='inventory_audit_logs', to=settings.AUTH_USER_MODEL, verbose_name='Usuario')),
            ],
            options={
                'verbose_name': 'Auditoría de Inventario',
                'verbose_name_plural': 'Auditorías de Inventario',
                'ordering': ['-timestamp'],
            },
        ),
        migrations.CreateModel(
            name='StockReservation',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('quantity_reserved', models.DecimalField(decimal_places=3, max_digits=12, verbose_name='Cantidad reservada')),
                ('status', models.CharField(choices=[('reserved', 'Reservado'), ('approved', 'Aprobado'), ('rejected', 'Rechazado'), ('cancelled', 'Cancelado')], default='reserved', max_length=20, verbose_name='Estado')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Fecha creación')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Última actualización')),
                ('inventory', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reservations', to='provider_inventory.providerinventory', verbose_name='Inventario')),
                ('quote', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stock_reservations', to='quotes.quote', verbose_name='Cotización')),
                ('quote_item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stock_reservations', to='quotes.quoteitem', verbose_name='Ítem Cotización')),
            ],
            options={
                'verbose_name': 'Reserva de Stock',
                'verbose_name_plural': 'Reservas de Stock',
            },
        ),
        migrations.AddIndex(
            model_name='providerinventory',
            index=models.Index(fields=['product_name', 'provider'], name='provider_in_product_provider_idx'),
        ),
        migrations.AddIndex(
            model_name='providerinventory',
            index=models.Index(fields=['provider', 'stock_quantity'], name='provider_in_provider_stock_idx'),
        ),
        migrations.AddIndex(
            model_name='providerinventory',
            index=models.Index(fields=['product_name'], name='provider_in_product_name_idx'),
        ),
        migrations.AddIndex(
            model_name='providerinventory',
            index=models.Index(fields=['last_updated'], name='provider_in_last_updated_idx'),
        ),
        migrations.AddIndex(
            model_name='providerinventoryauditlog',
            index=models.Index(fields=['inventory', 'timestamp'], name='provider_in_inventory_timestamp_idx'),
        ),
        migrations.AddIndex(
            model_name='providerinventoryauditlog',
            index=models.Index(fields=['source', 'timestamp'], name='provider_in_source_timestamp_idx'),
        ),
        migrations.AddIndex(
            model_name='providerinventoryauditlog',
            index=models.Index(fields=['user', 'timestamp'], name='provider_in_user_timestamp_idx'),
        ),
        migrations.AddIndex(
            model_name='providerinventoryauditlog',
            index=models.Index(fields=['invoice_id'], name='provider_in_invoice_id_idx'),
        ),
        migrations.AddIndex(
            model_name='providerinventoryauditlog',
            index=models.Index(fields=['quote_id'], name='provider_in_quote_id_idx'),
        ),
        migrations.AddIndex(
            model_name='providerinventorypricehistory',
            index=models.Index(fields=['inventory', 'recorded_at'], name='provider_in_inventory_recorded_idx'),
        ),
        migrations.AddIndex(
            model_name='stockreservation',
            index=models.Index(fields=['quote', 'status'], name='provider_in_quote_status_idx'),
        ),
        migrations.AddIndex(
            model_name='stockreservation',
            index=models.Index(fields=['inventory', 'status'], name='provider_in_inventory_status_idx'),
        ),
    ]
