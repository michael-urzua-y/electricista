# Generated manually

from django.db import migrations, models
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('workers', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='worker',
            name='gratification',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('0'), max_digits=12,
                verbose_name='Gratificación',
            ),
        ),
        migrations.AddField(
            model_name='worker',
            name='meal_allowance',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('0'), max_digits=12,
                verbose_name='Colación',
            ),
        ),
        migrations.AddField(
            model_name='worker',
            name='transport_allowance',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('0'), max_digits=12,
                verbose_name='Movilización',
            ),
        ),
        migrations.AddField(
            model_name='worker',
            name='other_allowance',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('0'), max_digits=12,
                verbose_name='Otras asignaciones',
            ),
        ),
        migrations.AddField(
            model_name='worker',
            name='additional_health',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('0'), max_digits=12,
                verbose_name='Adicional Salud (Isapre)',
            ),
        ),
        migrations.AlterField(
            model_name='worker',
            name='afp_rate',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('10.69'), max_digits=5,
                verbose_name='% AFP',
            ),
        ),
    ]
