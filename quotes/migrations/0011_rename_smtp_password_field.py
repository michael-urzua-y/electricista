"""
Migración manual para renombrar smtp_password a _smtp_password en SMTPConfig.
La columna en la BD sigue siendo 'smtp_password' (via db_column).
"""
from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('quotes', '0010_add_smtp_config'),
    ]

    operations = [
        # Renombrar el campo Python de smtp_password a _smtp_password
        # La columna en la BD sigue siendo 'smtp_password' gracias a db_column
        migrations.RenameField(
            model_name='smtpconfig',
            old_name='smtp_password',
            new_name='_smtp_password',
        ),
        # Cambiar el tipo de CharField a TextField para soportar valores encriptados más largos
        migrations.AlterField(
            model_name='smtpconfig',
            name='_smtp_password',
            field=models.TextField(verbose_name='Contraseña SMTP (encriptada)', db_column='smtp_password'),
        ),
        # Actualizar smtp_user a EmailField (ya era EmailField en la migración anterior, solo actualizar help_text)
        migrations.AlterField(
            model_name='smtpconfig',
            name='smtp_user',
            field=models.EmailField(max_length=254, verbose_name='Usuario SMTP', help_text='Correo de envío'),
        ),
        # Actualizar discount_percentage en Quote para incluir validators
        migrations.AlterField(
            model_name='quote',
            name='discount_percentage',
            field=models.DecimalField(
                max_digits=5,
                decimal_places=2,
                default=0,
                validators=[
                    django.core.validators.MinValueValidator(0),
                    django.core.validators.MaxValueValidator(100),
                ],
                verbose_name='Porcentaje de descuento',
            ),
        ),
        # Renombrar el índice
        migrations.RenameIndex(
            model_name='smtpconfig',
            new_name='quotes_smtp_user_id_f5f83b_idx',
            old_name='quotes_smtp_user_id_is_act_idx',
        ),
    ]
