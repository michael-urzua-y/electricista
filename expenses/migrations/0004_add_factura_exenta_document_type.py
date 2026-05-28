from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('expenses', '0003_rename_expenses_ex_date_d4f3a7_idx_expenses_ex_date_840b41_idx_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='expense',
            name='document_type',
            field=models.CharField(
                blank=True,
                choices=[
                    ('boleta', 'Boleta'),
                    ('factura', 'Factura'),
                    ('factura_exenta', 'Factura exenta'),
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
