from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='stock',
            field=models.DecimalField(
                decimal_places=3,
                default=0,
                max_digits=12,
                verbose_name='Stock disponible',
            ),
        ),
        migrations.AlterField(
            model_name='product',
            name='unit',
            field=models.CharField(
                blank=True,
                choices=[
                    ('unidad', 'Unidad'),
                    ('metro', 'Metro'),
                    ('rollo', 'Rollo'),
                    ('caja', 'Caja'),
                    ('kg', 'Kilogramo'),
                    ('litro', 'Litro'),
                ],
                default='unidad',
                max_length=20,
                verbose_name='Unidad',
            ),
        ),
    ]
