# Generated migration for adding provider inventory fields to QuoteItem

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('quotes', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='quoteitem',
            name='provider_inventory_id',
            field=models.BigIntegerField(blank=True, null=True, verbose_name='ID Inventario Proveedor'),
        ),
        migrations.AddField(
            model_name='quoteitem',
            name='provider_id',
            field=models.BigIntegerField(blank=True, null=True, verbose_name='ID Proveedor'),
        ),
    ]
