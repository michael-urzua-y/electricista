from rest_framework import serializers
from .models import Provider, Product, PriceHistory, PriceAlert


class ProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Provider
        fields = ['id', 'name', 'website', 'category', 'logo_url', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class ProductSerializer(serializers.ModelSerializer):
    provider_name = serializers.SerializerMethodField()  # nombre del proveedor asignado (puede ser None)
    latest_price = serializers.SerializerMethodField()
    provider_names = serializers.SerializerMethodField()  # lista de proveedores con precios

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'brand', 'model', 'provider',
                  'provider_name', 'category', 'unit', 'image_url', 'is_active',
                  'created_at', 'updated_at', 'latest_price', 'provider_names']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_provider_name(self, obj):
        # Proveedor asignado al producto (puede ser None)
        return obj.provider.name if obj.provider else None

    def get_latest_price(self, obj):
        latest = obj.price_history.first()
        if latest:
            return {
                'price': str(latest.price),
                'currency': latest.currency,
                'date': latest.recorded_at.strftime('%Y-%m-%d'),
                'provider': latest.provider.name
            }
        return None

    def get_provider_names(self, obj):
        # Proveedores únicos que tienen precios para este producto
        from .models import Provider
        provider_ids = obj.price_history.values_list('provider_id', flat=True).distinct()
        providers = Provider.objects.filter(id__in=provider_ids)
        return [p.name for p in providers]


class PriceHistorySerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    provider_name = serializers.CharField(source='provider.name', read_only=True)

    class Meta:
        model = PriceHistory
        fields = ['id', 'product', 'product_name', 'provider', 'provider_name',
                  'price', 'currency', 'recorded_at', 'source_url']
        read_only_fields = ['id', 'recorded_at']


class PriceAlertSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    provider_name = serializers.CharField(source='provider.name', read_only=True)

    class Meta:
        model = PriceAlert
        fields = ['id', 'product', 'product_name', 'provider', 'provider_name',
                  'alert_type', 'previous_price', 'current_price', 'variation_percent',
                  'threshold_value', 'is_read', 'created_at']
        read_only_fields = ['id', 'created_at']
