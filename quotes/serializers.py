from rest_framework import serializers
from .models import CompanyProfile, Quote, QuoteItem
from .validators import validate_rut, validate_logo_base64, validate_positive_decimal, validate_text_safe
from .quote_number_service import next_quote_number
from products.models import Product


class CompanyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyProfile
        fields = ['id', 'name', 'rut', 'address', 'phone', 'email', 'logo_base64', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_rut(self, value):
        validate_rut(value)
        return value

    def validate_logo_base64(self, value):
        validate_logo_base64(value)
        return value


class QuoteItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuoteItem
        fields = ['id', 'product', 'product_name', 'quantity', 'unit', 'unit_price', 'line_total']
        read_only_fields = ['id', 'product_name', 'unit', 'line_total']

    def validate_quantity(self, value):
        validate_positive_decimal(value)
        return value

    def validate_unit_price(self, value):
        validate_positive_decimal(value)
        return value


class QuoteItemCreateSerializer(serializers.ModelSerializer):
    # Campos opcionales para productos que vienen del buscador por proveedor
    product_name_override = serializers.CharField(required=False, allow_blank=True, write_only=True)
    unit_override = serializers.CharField(required=False, allow_blank=True, write_only=True)
    provider_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    provider_inventory_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = QuoteItem
        fields = ['product', 'quantity', 'unit_price', 'product_name_override', 'unit_override',
                  'provider_id', 'provider_inventory_id']

    def validate_quantity(self, value):
        validate_positive_decimal(value)
        return value

    def validate_unit_price(self, value):
        validate_positive_decimal(value)
        return value


class QuoteListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quote
        fields = ['id', 'quote_number', 'client_name', 'status', 'total_amount', 'created_at', 'valid_until']
        read_only_fields = ['id', 'quote_number', 'client_name', 'status', 'total_amount', 'created_at', 'valid_until']


class QuoteDetailSerializer(serializers.ModelSerializer):
    items = QuoteItemSerializer(many=True, read_only=True)

    class Meta:
        model = Quote
        fields = [
            'id', 'quote_number', 'client_name', 'client_rut', 'client_email',
            'status', 'subtotal', 'tax_amount', 'total_amount',
            'notes', 'valid_until', 'created_at', 'updated_at', 'status_updated_at',
            'items',
        ]
        read_only_fields = [
            'id', 'quote_number', 'client_name', 'client_rut', 'client_email',
            'status', 'subtotal', 'tax_amount', 'total_amount',
            'notes', 'valid_until', 'created_at', 'updated_at', 'status_updated_at',
            'items',
        ]


class QuoteCreateSerializer(serializers.ModelSerializer):
    items = QuoteItemCreateSerializer(many=True, write_only=True)

    class Meta:
        model = Quote
        fields = [
            'id', 'quote_number', 'client_name', 'client_rut', 'client_email',
            'notes', 'valid_until', 'items',
            'subtotal', 'tax_amount', 'total_amount', 'status', 'created_at',
        ]
        read_only_fields = ['id', 'quote_number', 'subtotal', 'tax_amount', 'total_amount', 'status', 'created_at']

    def validate_client_name(self, value):
        return validate_text_safe(value) or value

    def validate_notes(self, value):
        return validate_text_safe(value) or value

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        validated_data['quote_number'] = next_quote_number()
        quote = Quote.objects.create(**validated_data)
        for item_data in items_data:
            product = item_data.get('product')
            product_name = (
                item_data.pop('product_name_override', None)
                or (product.name if product else 'Producto eliminado')
            )
            unit = (
                item_data.pop('unit_override', None)
                or (product.unit if product else 'unidad')
            )
            provider_id = item_data.pop('provider_id', None)
            provider_inventory_id = item_data.pop('provider_inventory_id', None)
            QuoteItem.objects.create(
                quote=quote,
                product=product,
                product_name=product_name,
                unit=unit,
                quantity=item_data['quantity'],
                unit_price=item_data['unit_price'],
                line_total=item_data['quantity'] * item_data['unit_price'],
                provider_id=provider_id,
                provider_inventory_id=provider_inventory_id,
            )
        quote.recalculate_totals()
        return quote

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                product = item_data.get('product')
                product_name = (
                    item_data.pop('product_name_override', None)
                    or (product.name if product else 'Producto eliminado')
                )
                unit = (
                    item_data.pop('unit_override', None)
                    or (product.unit if product else 'unidad')
                )
                provider_id = item_data.pop('provider_id', None)
                provider_inventory_id = item_data.pop('provider_inventory_id', None)
                QuoteItem.objects.create(
                    quote=instance,
                    product=product,
                    product_name=product_name,
                    unit=unit,
                    quantity=item_data['quantity'],
                    unit_price=item_data['unit_price'],
                    line_total=item_data['quantity'] * item_data['unit_price'],
                    provider_id=provider_id,
                    provider_inventory_id=provider_inventory_id,
                )
            instance.recalculate_totals()
        return instance
