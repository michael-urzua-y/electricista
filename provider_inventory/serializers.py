"""
Serializers para provider_inventory API.
"""
from rest_framework import serializers
from .models import (
    ProviderInventory,
    ProviderInventoryAuditLog,
    StockReservation,
    ProviderInventoryPriceHistory,
)


class ProviderInventorySerializer(serializers.ModelSerializer):
    """Serializer para ProviderInventory."""
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    
    class Meta:
        model = ProviderInventory
        fields = [
            'id', 'product_name', 'provider', 'provider_name',
            'stock_quantity', 'unit_price', 'unit_measure',
            'last_updated', 'created_at',
        ]
        read_only_fields = ['id', 'last_updated', 'created_at']


class ProviderInventoryDetailSerializer(serializers.ModelSerializer):
    """Serializer detallado para ProviderInventory con historial."""
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    price_history = serializers.SerializerMethodField()
    recent_audit_logs = serializers.SerializerMethodField()
    
    class Meta:
        model = ProviderInventory
        fields = [
            'id', 'product_name', 'provider', 'provider_name',
            'stock_quantity', 'unit_price', 'unit_measure',
            'last_updated', 'created_at', 'price_history', 'recent_audit_logs',
        ]
        read_only_fields = ['id', 'last_updated', 'created_at']
    
    def get_price_history(self, obj):
        """Obtiene los últimos 5 registros de precio."""
        history = obj.price_history.all()[:5]
        return [
            {
                'unit_price': float(h.unit_price),
                'source': h.source,
                'recorded_at': h.recorded_at.isoformat(),
            }
            for h in history
        ]
    
    def get_recent_audit_logs(self, obj):
        """Obtiene los últimos 10 logs de auditoría."""
        logs = obj.audit_logs.all()[:10]
        return [
            {
                'action': log.action,
                'quantity_before': float(log.quantity_before),
                'quantity_after': float(log.quantity_after),
                'source': log.source,
                'timestamp': log.timestamp.isoformat(),
            }
            for log in logs
        ]


class ProviderInventoryAuditLogSerializer(serializers.ModelSerializer):
    """Serializer para ProviderInventoryAuditLog."""
    product_name = serializers.CharField(source='inventory.product_name', read_only=True)
    provider_name = serializers.CharField(source='inventory.provider.name', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = ProviderInventoryAuditLog
        fields = [
            'id', 'action', 'product_name', 'provider_name',
            'quantity_before', 'quantity_after', 'quantity_changed',
            'source', 'user_name', 'timestamp', 'notes',
        ]
        read_only_fields = ['id', 'timestamp']


class StockReservationSerializer(serializers.ModelSerializer):
    """Serializer para StockReservation."""
    product_name = serializers.CharField(source='inventory.product_name', read_only=True)
    provider_name = serializers.CharField(source='inventory.provider.name', read_only=True)
    
    class Meta:
        model = StockReservation
        fields = [
            'id', 'quote_id', 'quote_item_id', 'inventory_id',
            'product_name', 'provider_name', 'quantity_reserved',
            'status', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ProviderInventoryPriceHistorySerializer(serializers.ModelSerializer):
    """Serializer para ProviderInventoryPriceHistory."""
    product_name = serializers.CharField(source='inventory.product_name', read_only=True)
    
    class Meta:
        model = ProviderInventoryPriceHistory
        fields = [
            'id', 'product_name', 'unit_price', 'source',
            'invoice_id', 'recorded_at',
        ]
        read_only_fields = ['id', 'recorded_at']
