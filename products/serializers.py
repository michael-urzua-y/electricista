from rest_framework import serializers
from .models import Provider, Product, PriceHistory


class ProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Provider
        fields = ['id', 'name', 'rut', 'website', 'category', 'logo_url', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class ProductSerializer(serializers.ModelSerializer):
    provider_name = serializers.SerializerMethodField()
    latest_price = serializers.SerializerMethodField()
    provider_names = serializers.SerializerMethodField()
    markup_percentage = serializers.SerializerMethodField()
    sell_price = serializers.SerializerMethodField()
    provider_stock = serializers.SerializerMethodField()
    provider_inventory_id = serializers.SerializerMethodField()
    minimum_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'brand', 'model', 'provider',
                  'provider_name', 'category', 'unit', 'image_url', 'is_active',
                  'created_at', 'updated_at', 'latest_price', 'provider_names',
                  'markup_percentage', 'sell_price', 'provider_stock',
                  'provider_inventory_id', 'minimum_stock']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_provider_name(self, obj):
        # Proveedor asignado al producto (puede ser None)
        return obj.provider.name if obj.provider else None

    def get_latest_price(self, obj):
        """
        Si hay provider_id en contexto: retorna el precio de ese proveedor
        desde InvoiceItem (fuente de verdad = facturas).
        Sin filtro: retorna un dict {provider_name: {price, date}} para
        todos los proveedores, para que el frontend muestre el precio correcto
        al agrupar por proveedor.
        """
        provider_id = self.context.get('provider_id')

        if provider_id:
            last_item = self._get_last_item_for_provider(obj, provider_id)
            if last_item and last_item.unit_price is not None:
                from products.models import Provider
                try:
                    prov = Provider.objects.get(id=provider_id)
                    return {
                        'price': str(last_item.unit_price),
                        'currency': 'CLP',
                        'date': last_item.invoice.issue_date.strftime('%Y-%m-%d') if last_item.invoice.issue_date else '',
                        'provider': prov.name,
                    }
                except Provider.DoesNotExist:
                    pass
            return None

        # Sin filtro: devolver precio por proveedor (igual que markup/sell_price)
        from invoices.models import InvoiceItem
        provider_ids = obj.price_history.values_list('provider_id', flat=True).distinct()
        result = {}
        for pid in provider_ids:
            item = InvoiceItem.objects.filter(
                product=obj,
                unit_price__isnull=False,
                invoice__status='completed',
                invoice__provider_id=pid,
            ).order_by('-invoice__issue_date', '-id').first()
            if item and item.unit_price is not None:
                from products.models import Provider
                try:
                    prov = Provider.objects.get(id=pid)
                    result[prov.name] = {
                        'price': str(item.unit_price),
                        'currency': 'CLP',
                        'date': item.invoice.issue_date.strftime('%Y-%m-%d') if item.invoice.issue_date else '',
                        'provider': prov.name,
                    }
                except Provider.DoesNotExist:
                    pass

        # Fallback: si no hay InvoiceItems, usar PriceHistory
        if not result:
            qs = obj.price_history.select_related('provider')
            latest = qs.first()
            if latest:
                return {
                    'price': str(latest.price),
                    'currency': latest.currency,
                    'date': latest.recorded_at.strftime('%Y-%m-%d'),
                    'provider': latest.provider.name,
                }
        return result if result else None

    def get_provider_names(self, obj):
        """Proveedores únicos que tienen precios registrados para este producto."""
        from .models import Provider
        provider_ids = obj.price_history.values_list('provider_id', flat=True).distinct()
        providers = Provider.objects.filter(id__in=provider_ids)
        return [p.name for p in providers]

    def get_provider_stock(self, obj):
        """
        Retorna el stock desde ProviderInventory.
        Con provider_id en contexto: retorna el stock de ese proveedor (número).
        Sin filtro: retorna un dict {provider_name: stock}.
        """
        try:
            provider_id = self.context.get('provider_id')

            if provider_id:
                results = self._find_inventory_items(obj, provider_id)
                return float(results[0].stock_quantity) if results else 0

            from products.models import Provider
            provider_ids = obj.price_history.values_list('provider_id', flat=True).distinct()
            result = {}
            for pid in provider_ids:
                results = self._find_inventory_items(obj, pid)
                if results:
                    try:
                        prov = Provider.objects.get(id=pid)
                        result[prov.name] = float(results[0].stock_quantity)
                    except Provider.DoesNotExist:
                        pass
            return result if result else None
        except Exception:
            return None

    def _find_inventory_items(self, obj, provider_id=None):
        """
        Busca ProviderInventory para este producto usando el mapa pre-cargado en contexto.
        Fallback a query directa si no hay mapa (ej: en tests).
        """
        inventory_map = self.context.get('inventory_map')

        if inventory_map is not None:
            name_lower = obj.name.lower()
            results = []
            for (inv_name, inv_pid), inv in inventory_map.items():
                if provider_id and inv_pid != int(provider_id):
                    continue
                # Coincidencia exacta primero
                if inv_name == name_lower:
                    return [inv]
                # Coincidencia parcial
                if name_lower in inv_name or inv_name in name_lower:
                    results.append(inv)
            return results

        # Fallback: query directa
        try:
            from provider_inventory.models import ProviderInventory
            qs = ProviderInventory.objects.select_related('provider')
            if provider_id:
                qs = qs.filter(provider_id=provider_id)
            inv = qs.filter(product_name__iexact=obj.name).first()
            if inv:
                return [inv]
            return list(qs.filter(product_name__icontains=obj.name))
        except Exception:
            return []

    def get_provider_inventory_id(self, obj):
        """
        Con provider_id en contexto: retorna el ID del ProviderInventory (número).
        Sin filtro: retorna dict {provider_name: inventory_id}.
        """
        provider_id = self.context.get('provider_id')
        if provider_id:
            results = self._find_inventory_items(obj, provider_id)
            return results[0].id if results else None

        from products.models import Provider
        provider_ids = obj.price_history.values_list('provider_id', flat=True).distinct()
        result = {}
        for pid in provider_ids:
            results = self._find_inventory_items(obj, pid)
            if results:
                try:
                    prov = Provider.objects.get(id=pid)
                    result[prov.name] = results[0].id
                except Provider.DoesNotExist:
                    pass
        return result if result else None

    def get_minimum_stock(self, obj):
        """
        Con provider_id en contexto: retorna minimum_stock del ProviderInventory (número).
        Sin filtro: retorna dict {provider_name: minimum_stock}.
        """
        provider_id = self.context.get('provider_id')
        if provider_id:
            results = self._find_inventory_items(obj, provider_id)
            if results:
                ms = results[0].minimum_stock
                return float(ms) if ms is not None else None
            return None

        from products.models import Provider
        provider_ids = obj.price_history.values_list('provider_id', flat=True).distinct()
        result = {}
        for pid in provider_ids:
            results = self._find_inventory_items(obj, pid)
            if results:
                try:
                    prov = Provider.objects.get(id=pid)
                    ms = results[0].minimum_stock
                    result[prov.name] = float(ms) if ms is not None else None
                except Provider.DoesNotExist:
                    pass
        return result if result else None

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
        from decimal import Decimal
        provider_id = self.context.get('provider_id')
        if provider_id:
            last_item = self._get_last_item_for_provider(obj, provider_id)
            if last_item and last_item.unit_price is not None:
                markup = last_item.markup_percentage or Decimal('0')
                sell = last_item.unit_price * (1 + markup / Decimal('100'))
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
                    markup = item.markup_percentage or Decimal('0')
                    sell = item.unit_price * (1 + markup / Decimal('100'))
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
