"""
Serializers para el módulo de precios.
"""
from rest_framework import serializers
from .models import PriceItem, PriceSubItem


class PriceSubItemSerializer(serializers.ModelSerializer):
    """Serializer para Sub-Ítems de precio."""
    full_number = serializers.CharField(read_only=True)

    class Meta:
        model = PriceSubItem
        fields = [
            'id', 'item', 'sub_number', 'full_number',
            'description', 'net_value', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'sub_number', 'full_number', 'created_at', 'updated_at']
        extra_kwargs = {
            'item': {'required': False},
        }

    def validate_description(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('La descripción es obligatoria.')
        return value.strip()

    def validate_net_value(self, value):
        if value is None or value < 0:
            raise serializers.ValidationError('El valor neto debe ser un número positivo o cero.')
        return value


class PriceItemSerializer(serializers.ModelSerializer):
    """Serializer para Ítems de precio con sus sub-ítems anidados."""
    subitems = PriceSubItemSerializer(many=True, read_only=True)
    subitems_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = PriceItem
        fields = [
            'id', 'order_number', 'name', 'subitems',
            'subitems_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'order_number', 'subitems', 'subitems_count', 'created_at', 'updated_at']

    def validate_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('El nombre es obligatorio.')
        return value.strip()


class PriceItemListSerializer(serializers.ModelSerializer):
    """Serializer ligero para listados (sin sub-ítems completos)."""
    subitems_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = PriceItem
        fields = ['id', 'order_number', 'name', 'subitems_count', 'created_at', 'updated_at']
        read_only_fields = fields


class PriceSubItemSearchSerializer(serializers.ModelSerializer):
    """Serializer para búsqueda de sub-ítems en el endpoint de cotizaciones."""
    full_number = serializers.CharField(read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = PriceSubItem
        fields = ['id', 'description', 'net_value', 'full_number', 'item_name']
        read_only_fields = fields
