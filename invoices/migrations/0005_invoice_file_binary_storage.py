from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0004_invoice_markup_percentage_and_more'),
    ]

    operations = [
        # Agregar nuevos campos binarios
        migrations.AddField(
            model_name='invoice',
            name='file_data',
            field=models.BinaryField(blank=True, null=True, verbose_name='Datos del archivo'),
        ),
        migrations.AddField(
            model_name='invoice',
            name='file_name',
            field=models.CharField(blank=True, max_length=255, null=True, verbose_name='Nombre original'),
        ),
        migrations.AddField(
            model_name='invoice',
            name='file_size',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Tamaño (bytes)'),
        ),
        # Hacer el campo file opcional (para migración gradual)
        migrations.AlterField(
            model_name='invoice',
            name='file',
            field=models.FileField(
                blank=True,
                null=True,
                upload_to='invoices/',
                verbose_name='Archivo'
            ),
        ),
    ]
