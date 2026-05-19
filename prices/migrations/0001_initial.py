# Generated manually for prices app

from django.conf import settings
import django.core.validators
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PriceItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order_number', models.PositiveIntegerField(verbose_name='Número de orden')),
                ('name', models.CharField(max_length=200, verbose_name='Nombre')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='price_items', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Ítem de Precio',
                'verbose_name_plural': 'Ítems de Precio',
                'ordering': ['order_number'],
                'indexes': [models.Index(fields=['user', 'order_number'], name='prices_pric_user_id_order_idx')],
                'unique_together': {('user', 'order_number')},
            },
        ),
        migrations.CreateModel(
            name='PriceSubItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sub_number', models.PositiveIntegerField(verbose_name='Número de sub-ítem')),
                ('description', models.CharField(max_length=500, verbose_name='Descripción')),
                ('net_value', models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(0)], verbose_name='Valor Neto')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('item', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='subitems', to='prices.priceitem')),
            ],
            options={
                'verbose_name': 'Sub-Ítem de Precio',
                'verbose_name_plural': 'Sub-Ítems de Precio',
                'ordering': ['sub_number'],
                'indexes': [models.Index(fields=['item', 'sub_number'], name='prices_pric_item_id_sub_idx')],
                'unique_together': {('item', 'sub_number')},
            },
        ),
    ]
