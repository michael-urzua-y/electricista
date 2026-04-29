from rest_framework import serializers
from .models import ProviderInventory, ProviderInventoryAuditLog


class ProviderInventorySerializer(serializers.ModelSerializer):
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
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    recent_audit_logs = serializers.SerializerMethodField()

    class Meta:
        model = ProviderInventory
        fields = [
            'id', 'product_name', 'provider', 'provider_name',
            'stock_quantity', 'unit_price', 'unit_measure',
            'last_updated', 'created_at', 'recent_audit_logs',
        ]
        read_only_fields = ['id', 'last_updated', 'created_at']

    def get_recent_audit_logs(self, obj):
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
