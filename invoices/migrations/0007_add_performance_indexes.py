# Generated migration for adding performance indexes

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0006_remove_invoice_file'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='invoice',
            index=models.Index(fields=['user', 'status'], name='invoices_i_user_id_status_idx'),
        ),
        migrations.AddIndex(
            model_name='invoice',
            index=models.Index(fields=['provider', 'issue_date'], name='invoices_i_provider_issue_idx'),
        ),
        migrations.AddIndex(
            model_name='invoice',
            index=models.Index(fields=['user', 'created_at'], name='invoices_i_user_created_idx'),
        ),
        migrations.AddIndex(
            model_name='invoice',
            index=models.Index(fields=['status', 'created_at'], name='invoices_i_status_created_idx'),
        ),
        migrations.AddIndex(
            model_name='invoiceitem',
            index=models.Index(fields=['invoice', 'product'], name='invoices_i_invoice_product_idx'),
        ),
        migrations.AddIndex(
            model_name='invoiceitem',
            index=models.Index(fields=['product', 'unit_price'], name='invoices_i_product_price_idx'),
        ),
        migrations.AlterField(
            model_name='invoice',
            name='issue_date',
            field=models.DateField(blank=True, db_index=True, null=True, verbose_name='Fecha emisión'),
        ),
        migrations.AlterField(
            model_name='invoice',
            name='status',
            field=models.CharField(choices=[('pending', 'Pendiente'), ('processing', 'Procesando'), ('completed', 'Completada'), ('failed', 'Fallida')], db_index=True, default='pending', max_length=20, verbose_name='Estado'),
        ),
        migrations.AlterField(
            model_name='invoice',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
    ]
