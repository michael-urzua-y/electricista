# Generated manually

from decimal import Decimal

from django.db import migrations, models


def preserve_manual_isapre(apps, schema_editor):
    Worker = apps.get_model('workers', 'Worker')
    Worker.objects.filter(additional_health__gt=0).update(
        health_system='isapre',
        health_plan_unit='manual',
    )


class Migration(migrations.Migration):

    dependencies = [
        ('workers', '0002_add_salary_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='worker',
            name='health_system',
            field=models.CharField(
                choices=[('fonasa', 'Fonasa'), ('isapre', 'Isapre')],
                default='fonasa',
                max_length=10,
                verbose_name='Sistema de salud',
            ),
        ),
        migrations.AddField(
            model_name='worker',
            name='health_plan_unit',
            field=models.CharField(
                choices=[
                    ('manual', 'Adicional manual'),
                    ('uf', 'Plan en UF'),
                    ('clp', 'Plan en pesos'),
                ],
                default='manual',
                max_length=10,
                verbose_name='Tipo de plan de salud',
            ),
        ),
        migrations.AddField(
            model_name='worker',
            name='health_plan_uf',
            field=models.DecimalField(
                decimal_places=4,
                default=Decimal('0'),
                max_digits=8,
                verbose_name='Plan salud UF',
            ),
        ),
        migrations.AddField(
            model_name='worker',
            name='health_plan_clp',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0'),
                max_digits=12,
                verbose_name='Plan salud pesos',
            ),
        ),
        migrations.AddField(
            model_name='worker',
            name='health_uf_value',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0'),
                max_digits=12,
                verbose_name='Valor UF salud',
            ),
        ),
        migrations.RunPython(preserve_manual_isapre, migrations.RunPython.noop),
    ]
