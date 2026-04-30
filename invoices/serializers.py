import logging
import re
from decimal import Decimal
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import Invoice, InvoiceItem
from products.models import Provider

logger = logging.getLogger(__name__)
User = get_user_model()


def _calcular_variacion(precio_anterior: Decimal, precio_actual: Decimal) -> dict:
    """Calcula diferencia absoluta y porcentual entre dos precios."""
    diferencia = precio_actual - precio_anterior
    if precio_anterior == 0:
        variacion_porcentual = None
    else:
        variacion_porcentual = (diferencia / precio_anterior) * Decimal('100')
    return {'diferencia': diferencia, 'variacion_porcentual': variacion_porcentual}


class InvoiceItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    sell_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = InvoiceItem
        fields = ['id', 'description', 'quantity', 'unit_price', 'total_price',
                  'unit_measure', 'product', 'product_name', 'confidence',
                  'needs_review', 'notes', 'markup_percentage', 'sell_price']
        read_only_fields = ['id', 'total_price', 'sell_price']


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
        variacion = _calcular_variacion(precio_anterior, precio_actual)
        return {
            'precio_anterior': precio_anterior,
            'diferencia': variacion['diferencia'],
            'variacion_porcentual': variacion['variacion_porcentual'],
        }


class InvoiceListSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    items_count = serializers.SerializerMethodField()
    tiene_archivo = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = ['id', 'user', 'provider', 'provider_name', 'invoice_number',
                  'issue_date', 'total_amount', 'currency', 'status',
                  'file_name', 'file_type', 'tiene_archivo', 'created_at', 'items_count']
        read_only_fields = ['id', 'user', 'status', 'created_at']

    def get_items_count(self, obj):
        return obj.items.count()

    def get_tiene_archivo(self, obj):
        return bool(obj.file_data)


class InvoiceDetailSerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    items = InvoiceItemDetailSerializer(many=True, read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    tiene_archivo = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = ['id', 'user', 'user_name', 'provider', 'provider_name',
                  'invoice_number', 'issue_date', 'total_amount', 'tax_amount',
                  'subtotal_amount', 'currency', 'file_name', 'file_type',
                  'file_size', 'tiene_archivo', 'ocr_text',
                  'status', 'processing_notes', 'created_at', 'updated_at', 'items']
        read_only_fields = ['id', 'user', 'status', 'ocr_text', 'created_at', 'updated_at']

    def get_tiene_archivo(self, obj):
        """Indica si la factura tiene archivo binario disponible para visualizar."""
        return bool(obj.file_data)


class InvoiceUploadSerializer(serializers.ModelSerializer):
    """Serializer para subir facturas - el archivo se guarda como binario en BD"""
    provider = serializers.PrimaryKeyRelatedField(
        queryset=Provider.objects.all(),
        required=True,
        help_text='Proveedor de la factura'
    )
    file = serializers.FileField(
        required=True,
        write_only=True,
        help_text='Archivo PDF o imagen de la factura'
    )

    class Meta:
        model = Invoice
        fields = ['file', 'invoice_number', 'issue_date', 'provider', 'markup_percentage']
        extra_kwargs = {
            'issue_date': {'required': True}
        }

    def validate_file(self, value):
        """Validar tipo y tamaño del archivo"""
        # Límite de 10MB
        max_size = 10 * 1024 * 1024
        if value.size > max_size:
            error_msg = f'El archivo no puede superar 10MB. Tamaño actual: {value.size/1024/1024:.2f}MB'
            logger.warning(f"[UPLOAD] Archivo demasiado grande: {value.size} bytes")
            raise serializers.ValidationError(error_msg)

        # Validar tipo MIME real inspeccionando los bytes
        import magic
        file_header = value.read(2048)
        value.seek(0)

        mime_type = magic.from_buffer(file_header, mime=True)
        allowed_mimes = ['application/pdf', 'image/jpeg', 'image/png']

        if mime_type not in allowed_mimes:
            logger.warning(f"[UPLOAD] PELIGRO: Intento de subida inválida. MIME detectado: {mime_type}")
            raise serializers.ValidationError(f'Archivo no válido por seguridad. Se detectó: {mime_type}')

        # Validar extensión
        allowed_extensions = ['.pdf', '.jpg', '.jpeg', '.png']
        filename = value.name.lower()
        if not any(filename.endswith(ext) for ext in allowed_extensions):
            raise serializers.ValidationError('La extensión del archivo no coincide con el formato permitido.')

        logger.info(f"[UPLOAD] Archivo validado correctamente: {value.name}")
        return value

    def validate_invoice_number(self, value):
        """Validar formato del número de factura"""
        if value:  # Es opcional
            # Permitir: números, letras, guiones, espacios (máx 50 caracteres)
            if not re.match(r'^[A-Z0-9\-\s]{1,50}$', value, re.IGNORECASE):
                raise serializers.ValidationError(
                    'Número de factura inválido. Solo se permiten letras, números, guiones y espacios.'
                )
            # Evitar inyección de comandos
            if any(char in value for char in ['<', '>', '"', "'", '&', ';', '|', '\\', '/']):
                raise serializers.ValidationError('Número de factura contiene caracteres no permitidos.')
        return value

    def validate_issue_date(self, value):
        """Validar que la fecha sea válida y razonable"""
        from datetime import date
        today = date.today()
        
        # No puede ser futura
        if value > today:
            raise serializers.ValidationError('La fecha de emisión no puede ser futura.')
        
        # No puede ser muy antigua (más de 2 años)
        if (today - value).days > 730:
            raise serializers.ValidationError('La fecha no puede ser anterior a 2 años.')
        
        # No puede ser anterior a 2020
        if value < date(2020, 1, 1):
            raise serializers.ValidationError('La fecha no puede ser anterior a 2020.')
        
        logger.info(f"[INVOICE] Date validated: {value}")
        return value

    def validate_markup_percentage(self, value):
        """Validar porcentaje de margen"""
        if value < 0:
            raise serializers.ValidationError('El margen no puede ser negativo.')
        if value > 500:
            raise serializers.ValidationError('El margen no puede ser mayor a 500%.')
        return value

    def validate(self, data):
        """Validación a nivel de objeto"""
        # Validar que el proveedor existe y está activo
        provider = data.get('provider')
        if provider and not provider.is_active:
            raise serializers.ValidationError(
                {'provider': 'El proveedor está inactivo.'}
            )
        
        # Validar que el usuario no ha subido demasiadas facturas hoy
        user = self.context['request'].user
        today = timezone.now().date()
        invoices_today = Invoice.objects.filter(
            user=user,
            created_at__date=today
        ).count()
        
        if invoices_today >= 50:  # Límite de 50 facturas por día
            raise serializers.ValidationError(
                {'file': 'Límite de 50 facturas por día alcanzado.'}
            )
        
        return data
