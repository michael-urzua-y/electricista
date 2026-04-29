from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('products', '0002_add_stock_and_unit_choices'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Crear SEQUENCE solo en PostgreSQL usando noop para SQLite
        migrations.RunSQL(
            sql=migrations.RunSQL.noop,
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.CreateModel(
            name='CompanyProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, verbose_name='Nombre empresa')),
                ('rut', models.CharField(max_length=12, verbose_name='RUT')),
                ('address', models.CharField(blank=True, default='', max_length=300)),
                ('phone', models.CharField(blank=True, default='', max_length=20)),
                ('email', models.EmailField(max_length=254, verbose_name='Email empresa')),
                ('logo_base64', models.TextField(blank=True, default='', verbose_name='Logo (base64 PNG/JPEG, máx 2 MB)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='company_profile',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Perfil de Empresa',
            },
        ),
        migrations.CreateModel(
            name='Quote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quote_number', models.CharField(max_length=10, unique=True, verbose_name='Número cotización')),
                ('client_name', models.CharField(blank=True, default='', max_length=200)),
                ('client_rut', models.CharField(blank=True, default='', max_length=12)),
                ('client_email', models.EmailField(blank=True, default='')),
                ('status', models.CharField(
                    choices=[
                        ('draft', 'Borrador'),
                        ('sent', 'Enviada'),
                        ('approved', 'Aprobada'),
                        ('rejected', 'Rechazada'),
                    ],
                    db_index=True,
                    default='draft',
                    max_length=10,
                )),
                ('subtotal', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('tax_amount', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('total_amount', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('notes', models.TextField(blank=True, default='')),
                ('valid_until', models.DateField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('status_updated_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='quotes',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Cotización',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='QuoteItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('product_name', models.CharField(max_length=300, verbose_name='Nombre producto (snapshot)')),
                ('quantity', models.DecimalField(decimal_places=3, max_digits=12)),
                ('unit', models.CharField(default='unidad', max_length=20)),
                ('unit_price', models.DecimalField(decimal_places=2, max_digits=12)),
                ('line_total', models.DecimalField(decimal_places=2, max_digits=14)),
                ('quote', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='items',
                    to='quotes.quote',
                )),
                ('product', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='products.product',
                )),
            ],
            options={
                'ordering': ['id'],
            },
        ),
        migrations.AddIndex(
            model_name='quote',
            index=models.Index(fields=['user', 'status'], name='quotes_quot_user_id_status_idx'),
        ),
        migrations.AddIndex(
            model_name='quote',
            index=models.Index(fields=['user', 'created_at'], name='quotes_quot_user_id_created_at_idx'),
        ),
    ]
