from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.core.cache import cache
from .models import Provider, Product, PriceHistory, PriceAlert
from .serializers import ProviderSerializer, ProductSerializer, PriceHistorySerializer, PriceAlertSerializer


class ProviderViewSet(viewsets.ModelViewSet):
    """API para proveedores"""
    queryset = Provider.objects.all()
    serializer_class = ProviderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        # Intentar obtener de cache primero
        cache_key = 'providers_list'
        cached_data = cache.get(cache_key)
        
        if cached_data is not None:
            return Response(cached_data)
        
        # Si no está en cache, obtener de la base de datos
        response = super().list(request, *args, **kwargs)
        
        # Guardar en cache por 5 minutos
        cache.set(cache_key, response.data, 300)
        
        return response

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Cambiar estado activo/inactivo del proveedor"""
        provider = self.get_object()
        provider.is_active = not provider.is_active
        provider.save()
        
        # Invalidar cache cuando se modifica un proveedor
        cache.delete('providers_list')
        
        return Response({'is_active': provider.is_active})

    def perform_create(self, serializer):
        """Crear un nuevo proveedor y invalidar cache"""
        serializer.save()
        cache.delete('providers_list')

    def perform_update(self, serializer):
        """Actualizar un proveedor y invalidar cache"""
        serializer.save()
        cache.delete('providers_list')

    def perform_destroy(self, instance):
        """Eliminar un proveedor y invalidar cache"""
        instance.delete()
        cache.delete('providers_list')


class ProductViewSet(viewsets.ModelViewSet):
    """API para productos"""
    queryset = Product.objects.filter(is_active=True).select_related('provider')
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['provider', 'category']
    search_fields = ['name', 'brand', 'model']

    @action(detail=True, methods=['get'])
    def price_history(self, request, pk=None):
        """Obtener historial de precios de un producto"""
        product = self.get_object()
        history = product.price_history.all().select_related('provider')
        serializer = PriceHistorySerializer(history, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def alerts(self, request, pk=None):
        """Obtener alertas de un producto"""
        product = self.get_object()
        alerts = product.alerts.all().select_related('provider')
        serializer = PriceAlertSerializer(alerts, many=True)
        return Response(serializer.data)


class ComparacionViewSet(viewsets.ViewSet):
    """API para comparación de precios por producto entre proveedores"""
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        """
        Devuelve tabla comparativa de productos con precios por proveedor.
        Solo incluye proveedores que tienen al menos un precio registrado.
        """
        from products.models import Product, Provider, PriceHistory
        
        # Obtener productos activos que tengan al menos un precio en el historial
        products = Product.objects.filter(is_active=True, price_history__isnull=False).distinct().select_related('provider')
        
        # Obtener proveedores que tienen al menos un precio en el historial
        providers = Provider.objects.filter(pricehistory__isnull=False).distinct()
        provider_names = {p.name for p in providers}
        
        result = []
        for product in products:
            # Obtener el último precio de este producto en cada proveedor
            latest_prices = PriceHistory.objects.filter(product=product).order_by('provider', '-recorded_at')
            prices_by_provider = {}
            seen = set()
            for ph in latest_prices:
                if ph.provider_id not in seen:
                    prices_by_provider[ph.provider.name] = float(ph.price)
                    seen.add(ph.provider_id)
            
            # Solo incluir proveedores que tengan precio para este producto
            # (no rellenar con nulls)
            
            # Determinar más barato y más caro
            if prices_by_provider:
                min_provider = min(prices_by_provider, key=prices_by_provider.get)
                max_provider = max(prices_by_provider, key=prices_by_provider.get)
                best_price = prices_by_provider[min_provider]
                worst_price = prices_by_provider[max_provider]
            else:
                min_provider = None
                max_provider = None
                best_price = None
                worst_price = None
            
            result.append({
                'product_id': product.id,
                'product_name': product.name,
                'category': product.category,
                'prices': prices_by_provider,
                'best_provider': min_provider,
                'best_price': best_price,
                'worst_provider': max_provider,
                'worst_price': worst_price
            })
        
        return Response(result)
