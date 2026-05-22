from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('quotes', '0009_redesign_quote_items'),
    ]

    operations = [
        migrations.CreateModel(
            name='SMTPConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('smtp_host', models.CharField(max_length=200, verbose_name='Host SMTP')),
                ('smtp_port', models.PositiveIntegerField(default=587, verbose_name='Puerto')),
                ('smtp_user', models.EmailField(max_length=254, verbose_name='Usuario SMTP')),
                ('smtp_password', models.CharField(max_length=255, verbose_name='Contraseña SMTP')),
                ('use_tls', models.BooleanField(default=True, verbose_name='Usar TLS')),
                ('use_ssl', models.BooleanField(default=False, verbose_name='Usar SSL')),
                ('is_active', models.BooleanField(default=True, verbose_name='Configuración activa')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='smtp_config', to='auth.user')),
            ],
            options={
                'verbose_name': 'Configuración SMTP',
                'verbose_name_plural': 'Configuraciones SMTP',
            },
        ),
        migrations.AddIndex(
            model_name='smtpconfig',
            index=models.Index(fields=['user', 'is_active'], name='quotes_smtp_user_id_is_act_idx'),
        ),
    ]
