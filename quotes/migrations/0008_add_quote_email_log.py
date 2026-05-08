# Generated manually for QuoteEmailLog model

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('quotes', '0007_add_client_fk_to_quote'),
    ]

    operations = [
        migrations.CreateModel(
            name='QuoteEmailLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                ('recipient', models.EmailField(max_length=254)),
                ('status', models.CharField(
                    choices=[('success', 'Exitoso'), ('failed', 'Fallido')],
                    max_length=10,
                )),
                ('error_message', models.TextField(blank=True, default='')),
                ('quote', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='email_logs',
                    to='quotes.quote',
                )),
            ],
            options={
                'verbose_name': 'Registro de Envío de Email',
                'ordering': ['-sent_at'],
            },
        ),
    ]
