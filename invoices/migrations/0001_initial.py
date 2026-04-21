from django.db import migrations, models
import django.utils.timezone

class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('products', '0001_initial'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='Invoice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('invoice_number', models.CharField(blank=True, null=True, max_length=100, verbose_name='Número de factura')),
                ('issue_date', models.DateField(verbose_name='Fecha emisión')),
                ('total_amount', models.DecimalField(blank=True, null=True, decimal_places=2, max_digits=12, verbose_name='Monto total')),
                ('tax_amount', models.DecimalField(blank=True, null=True, decimal_places=2, max_digits=12, verbose_name='Impuestos')),
                ('subtotal_amount', models.DecimalField(blank=True, null=True, decimal_places=2, max_digits=12, verbose_name='Subtotal')),
                ('currency', models.CharField(default='CLP', max_length=3, verbose_name='Moneda')),
                ('file', models.FileField(upload_to='invoices/', verbose_name='Archivo')),
                ('file_type', models.CharField(blank=True, null=True, max_length=10, verbose_name='Tipo archivo')),
                ('ocr_text', models.TextField(blank=True, null=True, verbose_name='Texto OCR extraído')),
                ('status', models.CharField(choices=[('pending', 'Pendiente'), ('processing', 'Procesando'), ('completed', 'Completada'), ('failed', 'Fallida')], default='pending', max_length=20, verbose_name='Estado')),
                ('processing_notes', models.TextField(blank=True, null=True, verbose_name='Notas procesamiento')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provider', models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, related_name='invoices', to='products.provider', verbose_name='Proveedor')),
                ('user', models.ForeignKey(on_delete=models.CASCADE, related_name='invoices', to='auth.User', verbose_name='Usuario')),
            ],
            options={
                'verbose_name': 'Factura',
                'verbose_name_plural': 'Facturas',
                'ordering': ['-issue_date'],
            },
        ),
        migrations.CreateModel(
            name='InvoiceItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('description', models.CharField(max_length=500, verbose_name='Descripción')),
                ('quantity', models.DecimalField(decimal_places=2, default=1, max_digits=10, verbose_name='Cantidad')),
                ('unit_price', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Precio unitario')),
                ('total_price', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Precio total')),
                ('unit_measure', models.CharField(blank=True, null=True, max_length=20, verbose_name='Unidad de medida')),
                ('confidence', models.DecimalField(blank=True, null=True, decimal_places=2, max_digits=5, verbose_name='Confianza extracción (%)')),
                ('needs_review', models.BooleanField(default=False, verbose_name='Requiere revisión')),
                ('notes', models.TextField(blank=True, null=True, verbose_name='Notas')),
                ('invoice', models.ForeignKey(on_delete=models.CASCADE, related_name='items', to='invoices.invoice', verbose_name='Factura')),
                ('product', models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, related_name='invoice_items', to='products.product', verbose_name='Producto')),
            ],
            options={
                'verbose_name': 'Ítem de Factura',
                'verbose_name_plural': 'Ítems de Facturas',
                'ordering': ['id'],
            },
        ),
    ]
