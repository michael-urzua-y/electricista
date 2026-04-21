from django.db import migrations, models
import django.utils.timezone

class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Provider',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, verbose_name='Nombre')),
                ('website', models.URLField(blank=True, null=True, verbose_name='Sitio web')),
                ('category', models.CharField(choices=[('electricidad', 'Electricidad'), ('construccion', 'Construcción'), ('fontaneria', 'Fontanería'), ('herramientas', 'Herramientas'), ('general', 'General')], default='general', max_length=50, verbose_name='Categoría')),
                ('logo_url', models.URLField(blank=True, null=True, verbose_name='Logo URL')),
                ('is_active', models.BooleanField(default=True, verbose_name='Activo')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Proveedor',
                'verbose_name_plural': 'Proveedores',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='Product',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=300, verbose_name='Nombre')),
                ('description', models.TextField(blank=True, null=True, verbose_name='Descripción')),
                ('brand', models.CharField(blank=True, null=True, max_length=100, verbose_name='Marca')),
                ('model', models.CharField(blank=True, null=True, max_length=100, verbose_name='Modelo')),
                ('category', models.CharField(blank=True, null=True, max_length=50, verbose_name='Categoría')),
                ('unit', models.CharField(default='unidad', max_length=20, verbose_name='Unidad')),
                ('image_url', models.URLField(blank=True, null=True, verbose_name='Imagen URL')),
                ('is_active', models.BooleanField(default=True, verbose_name='Activo')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provider', models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, related_name='products', to='products.provider', verbose_name='Proveedor')),
            ],
            options={
                'verbose_name': 'Producto',
                'verbose_name_plural': 'Productos',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='PriceHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('price', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Precio')),
                ('currency', models.CharField(default='CLP', max_length=3, verbose_name='Moneda')),
                ('recorded_at', models.DateTimeField(auto_now_add=True, verbose_name='Fecha registro')),
                ('source_url', models.URLField(blank=True, null=True, verbose_name='Fuente URL')),
                ('product', models.ForeignKey(on_delete=models.CASCADE, related_name='price_history', to='products.product', verbose_name='Producto')),
                ('provider', models.ForeignKey(on_delete=models.CASCADE, to='products.Provider', verbose_name='Proveedor')),
            ],
            options={
                'verbose_name': 'Historial de Precio',
                'verbose_name_plural': 'Historial de Precios',
                'ordering': ['-recorded_at'],
            },
        ),
        migrations.CreateModel(
            name='PriceAlert',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('alert_type', models.CharField(choices=[('increase', 'Subida'), ('decrease', 'Bajada'), ('threshold', 'Umbral')], max_length=10, verbose_name='Tipo')),
                ('previous_price', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Precio anterior')),
                ('current_price', models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Precio actual')),
                ('variation_percent', models.DecimalField(decimal_places=2, max_digits=6, verbose_name='Variación %')),
                ('threshold_value', models.DecimalField(blank=True, null=True, decimal_places=2, max_digits=6, verbose_name='Umbral configurado')),
                ('is_read', models.BooleanField(default=False, verbose_name='Leída')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Fecha creación')),
                ('product', models.ForeignKey(on_delete=models.CASCADE, related_name='alerts', to='products.product', verbose_name='Producto')),
                ('provider', models.ForeignKey(on_delete=models.CASCADE, to='products.Provider', verbose_name='Proveedor')),
            ],
            options={
                'verbose_name': 'Alerta de Precio',
                'verbose_name_plural': 'Alertas de Precios',
                'ordering': ['-created_at'],
            },
        ),
    ]
