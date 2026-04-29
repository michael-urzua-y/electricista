from django.apps import AppConfig


class ProviderInventoryConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'provider_inventory'
    
    def ready(self):
        """Registra signals cuando la app está lista."""
        import provider_inventory.signals  # noqa
