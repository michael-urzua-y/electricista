# Generated migration for minimum_stock field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('provider_inventory', '0004_remove_unused_tables'),
    ]

    operations = [
        migrations.AddField(
            model_name='providerinventory',
            name='minimum_stock',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=12,
                null=True,
                verbose_name='Stock mínimo',
            ),
        ),
    ]
