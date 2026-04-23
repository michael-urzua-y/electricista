import logging
from decimal import Decimal
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Invoice, InvoiceItem
from .comparison import calcular_variacion
from products.models import Provider

logger = logging.getLogger(__name__)


User = get_user_model()


class InvoiceItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = InvoiceItem
        fields = ['id', 'description', 'quantity', 'unit_price', 'total_price',
                  'unit_measure', 'product', 'product_name', 'confidence',
                  'needs_review', 'notes']
        read_only_fields = ['id', 'total_price']


class InvoiceItemDetailSerializer(InvoiceItemSerializer):
    """Item serializer enriched with price variation data relative to the previous invoice."""
    variacion = serializers.SerializerMethodField()

    class Meta(InvoiceItemSerializer.Meta):
        fields = InvoiceItemSerializer.Meta.fields + ['variacion']

    def get_variacion(self, obj):
        items_anteriores = self.context.get('items_anteriores')
        if items_anteriores is None:
            return None

        if obj.product_id is None:
            return None

        item_anterior = items_anteriores.get(obj.product_id)
        if item_anterior is None:
            return {'etiqueta': 'nuevo'}

        precio_anterior = item_anterior.unit_price or Decimal('0')
        precio_actual = obj.unit_price or Decimal('0')
        variacion = calcular_variacion(precio_anterior, precio_actual)
        return {
            'precio_anterior': precio_anterior,
            'diferencia': variacion['diferencia'],
            'variacion_porcentual': variacion['variacion_porcentual'],
        }


class InvoiceListSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = ['id', 'user', 'provider', 'provider_name', 'invoice_number',
                  'issue_date', 'total_amount', 'currency', 'status',
                  'created_at', 'items_count']
        read_only_fields = ['id', 'user', 'status', 'created_at']

    def get_items_count(self, obj):
        return obj.items.count()


class InvoiceDetailSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    items = InvoiceItemDetailSerializer(many=True, read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Invoice
        fields = ['id', 'user', 'user_name', 'provider', 'provider_name',
                  'invoice_number', 'issue_date', 'total_amount', 'tax_amount',
                  'subtotal_amount', 'currency', 'file', 'file_type', 'ocr_text',
                  'status', 'processing_notes', 'created_at', 'updated_at', 'items']
        read_only_fields = ['id', 'user', 'status', 'ocr_text', 'created_at', 'updated_at']


class InvoiceUploadSerializer(serializers.ModelSerializer):
    """Serializer para subir facturas"""
    provider = serializers.PrimaryKeyRelatedField(
        queryset=Provider.objects.all(),
        required=True,
        help_text='Proveedor de la factura'
    )
    
    class Meta:
        model = Invoice
        fields = ['file', 'invoice_number', 'issue_date', 'provider']
        extra_kwargs = {
            'file': {'required': True},
            'issue_date': {'required': True}
        }

    def validate_file(self, value):
        """Validar tipo de archivo"""
        allowed_extensions = ['.pdf', '.jpg', '.jpeg', '.png']
        filename = value.name
        ext = filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''
        dotted_ext = f'.{ext}'
        
        logger.info(f"[UPLOAD] Validando archivo: {filename}, extensión: {dotted_ext}, tamaño: {value.size} bytes")
        
        if dotted_ext not in allowed_extensions:
            error_msg = f'Tipo de archivo no permitido. Use: {", ".join(allowed_extensions)}'
            logger.warning(f"[UPLOAD] Extensión no permitida: {dotted_ext}")
            raise serializers.ValidationError(error_msg)
        
        # Límite de 10MB
        max_size = 10 * 1024 * 1024
        if value.size > max_size:
            error_msg = f'El archivo no puede superar 10MB. Tamaño actual: {value.size/1024/1024:.2f}MB'
            logger.warning(f"[UPLOAD] Archivo demasiado grande: {value.size} bytes")
            raise serializers.ValidationError(error_msg)
        
        logger.info(f"[UPLOAD] Archivo validado correctamente")
        return value

    def validate_issue_date(self, value):
        """Validar que la fecha no sea futura y no sea muy antigua"""
        from datetime import date
        today = date.today()
        if value > today:
            raise serializers.ValidationError('La fecha de emisión no puede ser futura')
        if value < date(2020, 1, 1):
            raise serializers.ValidationError('La fecha no puede ser anterior a 2020')
        return value


