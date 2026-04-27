from rest_framework import serializers
from .models import Provider, Product, PriceHistory, PriceAlert


class ProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Provider
        fields = ['id', 'name', 'website', 'category', 'logo_url', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class ProductSerializer(serializers.ModelSerializer):
    provider_name = serializers.SerializerMethodField()
    latest_price = serializers.SerializerMethodField()
    provider_names = serializers.SerializerMethodField()
    markup_percentage = serializers.SerializerMethodField()
    sell_price = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'brand', 'model', 'provider',
                  'provider_name', 'category', 'unit', 'image_url', 'is_active',
                  'created_at', 'updated_at', 'latest_price', 'provider_names',
                  'markup_percentage', 'sell_price']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_provider_name(self, obj):
        # Proveedor asignado al producto (puede ser None)
        return obj.provider.name if obj.provider else None

    def get_latest_price(self, obj):
        """
        Retorna el precio más reciente del proveedor que tiene el registro
        más nuevo para este producto. Si el contexto incluye 'provider_id',
        filtra por ese proveedor específico.
        """
        provider_id = self.context.get('provider_id')
        qs = obj.price_history.select_related('provider')
        if provider_id:
            qs = qs.filter(provider_id=provider_id)
        latest = qs.first()
        if latest:
            return {
                'price': str(latest.price),
                'currency': latest.currency,
                'date': latest.recorded_at.strftime('%Y-%m-%d'),
                'provider': latest.provider.name,
            }
        return None

    def get_provider_names(self, obj):
        """Proveedores únicos que tienen precios registrados para este producto."""
        from .models import Provider
        provider_ids = obj.price_history.values_list('provider_id', flat=True).distinct()
        providers = Provider.objects.filter(id__in=provider_ids)
        return [p.name for p in providers]

    def _get_last_item_for_provider(self, obj, provider_id=None):
        """
        Retorna el InvoiceItem más reciente para este producto.
        Si se pasa provider_id, filtra por ese proveedor específico.
        Así cada proveedor respeta su propio markup y precio.
        """
        from invoices.models import InvoiceItem
        qs = InvoiceItem.objects.filter(
            product=obj,
            markup_percentage__isnull=False,
            unit_price__isnull=False,
            invoice__status='completed',
        )
        if provider_id:
            qs = qs.filter(invoice__provider_id=provider_id)
        return qs.order_by('-invoice__issue_date', '-id').first()

    def get_markup_percentage(self, obj):
        """
        Si hay provider_id en contexto: markup de ese proveedor.
        Si no: devuelve un dict {provider_name: markup} para todos los proveedores
        que tienen historial de precios para este producto.
        """
        provider_id = self.context.get('provider_id')
        if provider_id:
            last_item = self._get_last_item_for_provider(obj, provider_id)
            if last_item and last_item.markup_percentage is not None:
                return str(last_item.markup_percentage)
            return '0'

        # Sin filtro: devolver markup por proveedor
        from invoices.models import InvoiceItem
        provider_ids = obj.price_history.values_list('provider_id', flat=True).distinct()
        result = {}
        for pid in provider_ids:
            item = InvoiceItem.objects.filter(
                product=obj,
                markup_percentage__isnull=False,
                unit_price__isnull=False,
                invoice__status='completed',
                invoice__provider_id=pid,
            ).order_by('-invoice__issue_date', '-id').first()
            if item:
                from products.models import Provider
                try:
                    prov = Provider.objects.get(id=pid)
                    result[prov.name] = str(item.markup_percentage)
                except Provider.DoesNotExist:
                    pass
        # Fallback: si no hay datos por proveedor, retornar '0'
        return result if result else '0'

    def get_sell_price(self, obj):
        """
        Si hay provider_id en contexto: sell_price de ese proveedor.
        Si no: devuelve un dict {provider_name: sell_price}.
        """
        provider_id = self.context.get('provider_id')
        if provider_id:
            last_item = self._get_last_item_for_provider(obj, provider_id)
            if last_item and last_item.unit_price is not None:
                markup = last_item.markup_percentage or 0
                sell = last_item.unit_price * (1 + markup / 100)
                return str(round(sell, 0))
            return None

        # Sin filtro: devolver sell_price por proveedor
        from invoices.models import InvoiceItem
        provider_ids = obj.price_history.values_list('provider_id', flat=True).distinct()
        result = {}
        for pid in provider_ids:
            item = InvoiceItem.objects.filter(
                product=obj,
                markup_percentage__isnull=False,
                unit_price__isnull=False,
                invoice__status='completed',
                invoice__provider_id=pid,
            ).order_by('-invoice__issue_date', '-id').first()
            if item and item.unit_price is not None:
                from products.models import Provider
                try:
                    prov = Provider.objects.get(id=pid)
                    markup = item.markup_percentage or 0
                    sell = item.unit_price * (1 + markup / 100)
                    result[prov.name] = str(round(sell, 0))
                except Provider.DoesNotExist:
                    pass
        return result if result else None


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
