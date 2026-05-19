# Generated manually

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Worker',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, verbose_name='Nombre')),
                ('rut', models.CharField(blank=True, max_length=12, null=True, verbose_name='RUT')),
                ('position', models.CharField(blank=True, max_length=200, null=True, verbose_name='Cargo')),
                ('gross_salary', models.DecimalField(decimal_places=2, max_digits=12, verbose_name='Sueldo Bruto')),
                ('afp_rate', models.DecimalField(decimal_places=2, default=Decimal('12.50'), max_digits=5, verbose_name='% AFP')),
                ('health_rate', models.DecimalField(decimal_places=2, default=Decimal('7.00'), max_digits=5, verbose_name='% Salud')),
                ('unemployment_rate', models.DecimalField(decimal_places=2, default=Decimal('0.60'), max_digits=5, verbose_name='% Seguro Cesantía')),
                ('is_active', models.BooleanField(default=True, verbose_name='Activo')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='workers', to=settings.AUTH_USER_MODEL, verbose_name='Usuario')),
            ],
            options={
                'verbose_name': 'Trabajador',
                'verbose_name_plural': 'Trabajadores',
                'ordering': ['name'],
            },
        ),
    ]
