from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invoices', '0008_rename_invoices_i_user_id_status_idx_invoices_in_user_id_ebcfda_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='received_date',
            field=models.DateField(blank=True, db_index=True, null=True, verbose_name='Fecha recepción'),
        ),
    ]
