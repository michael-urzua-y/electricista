# Generated manually: Redesign QuoteItem to use PriceSubItem instead of Product

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('quotes', '0008_add_quote_email_log'),
        ('prices', '0001_initial'),
    ]

    operations = [
        # --- Add new fields to QuoteItem ---
        migrations.AddField(
            model_name='quoteitem',
            name='price_sub_item',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='prices.pricesubitem',
                verbose_name='Sub-Ítem de Precio',
            ),
        ),
        migrations.AddField(
            model_name='quoteitem',
            name='description',
            field=models.CharField(
                default='',
                max_length=500,
                verbose_name='Descripción (snapshot)',
            ),
            preserve_default=False,
        ),

        # --- Add new fields to Quote ---
        migrations.AddField(
            model_name='quote',
            name='discount_percentage',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                max_digits=5,
                verbose_name='Porcentaje de descuento',
            ),
        ),
        migrations.AddField(
            model_name='quote',
            name='discount_amount',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                max_digits=14,
            ),
        ),
        migrations.AddField(
            model_name='quote',
            name='total',
            field=models.DecimalField(
                decimal_places=2,
                default=0,
                max_digits=14,
            ),
        ),

        # --- Remove obsolete fields from QuoteItem ---
        migrations.RemoveField(
            model_name='quoteitem',
            name='product',
        ),
        migrations.RemoveField(
            model_name='quoteitem',
            name='product_name',
        ),
        migrations.RemoveField(
            model_name='quoteitem',
            name='unit',
        ),
        migrations.RemoveField(
            model_name='quoteitem',
            name='provider_id',
        ),
        migrations.RemoveField(
            model_name='quoteitem',
            name='provider_inventory_id',
        ),
    ]
