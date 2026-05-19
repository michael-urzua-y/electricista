# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('expenses', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='expense',
            name='is_company_invoice',
            field=models.BooleanField(default=False, verbose_name='Factura con RUT empresa'),
        ),
        migrations.AlterField(
            model_name='expense',
            name='document_type',
            field=models.CharField(
                blank=True,
                choices=[
                    ('boleta', 'Boleta'),
                    ('factura', 'Factura'),
                    ('honorario', 'Honorario'),
                    ('recibo', 'Recibo'),
                    ('voucher', 'Voucher'),
                    ('otro', 'Otro'),
                ],
                max_length=20,
                null=True,
                verbose_name='Tipo Documento',
            ),
        ),
    ]
