from django.db import migrations
import base64


def migrate_logos_to_binary(apps, schema_editor):
    """Convierte logos existentes de base64 a binario."""
    CompanyProfile = apps.get_model('quotes', 'CompanyProfile')
    for profile in CompanyProfile.objects.filter(logo_base64__gt=''):
        try:
            data = base64.b64decode(profile.logo_base64)
            # Detectar MIME por magic bytes
            mime = 'image/png' if data[:4] == b'\x89PNG' else 'image/jpeg'
            profile.logo_data = data
            profile.logo_mime = mime
            profile.logo_size = len(data)
            profile.save(update_fields=['logo_data', 'logo_mime', 'logo_size'])
        except Exception as e:
            print(f"Error migrando logo de {profile.name}: {e}")


def reverse_migration(apps, schema_editor):
    """Reverse: no hace nada (los datos base64 siguen intactos)."""
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('quotes', '0005_add_logo_binary_fields'),
    ]

    operations = [
        migrations.RunPython(migrate_logos_to_binary, reverse_migration),
    ]
