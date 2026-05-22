from rest_framework import serializers
from .models import CompanyProfile, Quote, QuoteItem, SMTPConfig
from .validators import validate_rut, validate_logo_base64, validate_text_safe
from .quote_number_service import next_quote_number
from prices.models import PriceSubItem
from clients.models import Client


class CompanyProfileSerializer(serializers.ModelSerializer):
    # logo_upload: campo de entrada para subir archivo binario
    logo_upload = serializers.FileField(required=False, allow_null=True, write_only=True)
    has_logo = serializers.BooleanField(read_only=True)
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = CompanyProfile
        fields = ['id', 'name', 'rut', 'address', 'phone', 'email',
                  'logo_base64', 'logo_upload', 'has_logo', 'logo_url', 'logo_mime',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'has_logo', 'logo_url', 'logo_mime']

    def get_logo_url(self, obj):
        """Retorna la URL del endpoint que sirve el logo si existe."""
        if obj.has_logo:
            return f'/api/empresa/perfil/logo/'
        return None

    def validate_rut(self, value):
        validate_rut(value)
        return value

    def validate_logo_base64(self, value):
        # Solo validar si es un string no vacío (compatibilidad)
        if value:
            validate_logo_base64(value)
        return value

    def validate_logo_upload(self, value):
        if value is None:
            return value
        # Validar tamaño (2 MB máx)
        if value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError('El logo no puede superar 2 MB.')
        # Validar tipo MIME
        if value.content_type not in ('image/png', 'image/jpeg'):
            raise serializers.ValidationError('El logo debe ser PNG o JPEG.')
        return value

    def update(self, instance, validated_data):
        logo_file = validated_data.pop('logo_upload', None)
        if logo_file is not None:
            # Guardar logo como binario
            instance.logo_data = logo_file.read()
            instance.logo_mime = logo_file.content_type
            instance.logo_size = logo_file.size
            # Limpiar logo_base64 legacy
            instance.logo_base64 = ''
        return super().update(instance, validated_data)

    def create(self, validated_data):
        logo_file = validated_data.pop('logo_upload', None)
        instance = super().create(validated_data)
        if logo_file is not None:
            instance.logo_data = logo_file.read()
            instance.logo_mime = logo_file.content_type
            instance.logo_size = logo_file.size
            instance.logo_base64 = ''
            instance.save()
        return instance


class SMTPConfigSerializer(serializers.ModelSerializer):
    """Serializer para la configuración SMTP del usuario."""
    smtp_password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = SMTPConfig
        fields = [
            'id', 'smtp_host', 'smtp_port', 'smtp_user',
            'smtp_password', 'use_tls', 'use_ssl', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        user = self.context['request'].user
        password = validated_data.pop('smtp_password', '')
        validated_data['user'] = user
        instance = SMTPConfig(**validated_data)
        instance.smtp_password = password  # Uses the encrypting setter
        instance.save()
        return instance

    def update(self, instance, validated_data):
        validated_data.pop('user', None)
        password = validated_data.pop('smtp_password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.smtp_password = password  # Uses the encrypting setter
        instance.save()
        return instance


# --- Quote Item Serializers ---

class QuoteItemSerializer(serializers.ModelSerializer):
    """Serializer para detalle de QuoteItem (lectura)."""
    item_name = serializers.SerializerMethodField()

    class Meta:
        model = QuoteItem
        fields = ['id', 'price_sub_item', 'description', 'quantity', 'unit_price', 'line_total', 'item_name']
        read_only_fields = ['id', 'line_total', 'item_name']

    def get_item_name(self, obj):
        if obj.price_sub_item and obj.price_sub_item.item:
            return obj.price_sub_item.item.name
        return None


class QuoteItemCreateSerializer(serializers.Serializer):
    """Serializer para crear/actualizar ítems de cotización."""
    price_sub_item = serializers.IntegerField(required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2)
    unit_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('La cantidad debe ser mayor a 0.')
        return value

    def validate_unit_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('El precio unitario no puede ser negativo.')
        return value


# --- Quote Serializers ---

class QuoteListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quote
        fields = ['id', 'quote_number', 'client_id', 'client_name', 'status', 'total_amount', 'created_at', 'valid_until']
        read_only_fields = ['id', 'quote_number', 'client_id', 'client_name', 'status', 'total_amount', 'created_at', 'valid_until']


class QuoteDetailSerializer(serializers.ModelSerializer):
    items = QuoteItemSerializer(many=True, read_only=True)

    class Meta:
        model = Quote
        fields = [
            'id', 'quote_number', 'client_id', 'client_name', 'client_rut',
            'client_email', 'status', 'subtotal', 'discount_percentage',
            'discount_amount', 'total', 'tax_amount', 'total_amount',
            'notes', 'valid_until', 'created_at', 'updated_at',
            'status_updated_at', 'items',
        ]
        read_only_fields = [
            'id', 'quote_number', 'client_id', 'client_name', 'client_rut',
            'client_email', 'status', 'subtotal', 'discount_percentage',
            'discount_amount', 'total', 'tax_amount', 'total_amount',
            'notes', 'valid_until', 'created_at', 'updated_at',
            'status_updated_at', 'items',
        ]


class QuoteCreateSerializer(serializers.ModelSerializer):
    items = QuoteItemCreateSerializer(many=True, write_only=True)
    client_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    discount_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False, default=0
    )

    class Meta:
        model = Quote
        fields = [
            'id', 'quote_number', 'client_id', 'client_name', 'client_rut',
            'client_email', 'notes', 'valid_until', 'items', 'discount_percentage',
            'subtotal', 'discount_amount', 'total', 'tax_amount', 'total_amount',
            'status', 'created_at',
        ]
        read_only_fields = [
            'id', 'quote_number', 'subtotal', 'discount_amount', 'total',
            'tax_amount', 'total_amount', 'status', 'created_at',
        ]

    def validate_discount_percentage(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError(
                'El porcentaje de descuento debe estar entre 0 y 100.'
            )
        return value

    def validate_client_name(self, value):
        return validate_text_safe(value) or value

    def validate_notes(self, value):
        return validate_text_safe(value) or value

    def validate(self, attrs):
        client_id = attrs.pop('client_id', None)
        if client_id is not None:
            request = self.context.get('request')
            user = request.user if request else None
            try:
                client = Client.objects.get(pk=client_id, user=user)
            except Client.DoesNotExist:
                raise serializers.ValidationError(
                    {'client_id': 'Cliente no encontrado o no pertenece al usuario actual.'}
                )
            # Auto-populate snapshot fields from client data
            attrs['client'] = client
            if not attrs.get('client_name'):
                attrs['client_name'] = client.name
            if not attrs.get('client_rut'):
                attrs['client_rut'] = client.rut
            if not attrs.get('client_email'):
                attrs['client_email'] = client.email
        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        user = self.context['request'].user
        validated_data['quote_number'] = next_quote_number()
        quote = Quote.objects.create(**validated_data)

        for item_data in items_data:
            sub_item_id = item_data.get('price_sub_item')
            sub_item = None

            if sub_item_id:
                try:
                    sub_item = PriceSubItem.objects.get(
                        id=sub_item_id, item__user=user
                    )
                except PriceSubItem.DoesNotExist:
                    quote.delete()
                    raise serializers.ValidationError(
                        {'items': f'PriceSubItem {sub_item_id} no encontrado.'}
                    )

            description = item_data.get('description') or (sub_item.description if sub_item else '')
            unit_price = item_data.get('unit_price')
            if unit_price is None:
                unit_price = sub_item.net_value if sub_item else 0

            QuoteItem.objects.create(
                quote=quote,
                price_sub_item=sub_item,
                description=description,
                quantity=item_data['quantity'],
                unit_price=unit_price,
            )

        quote.recalculate_totals()
        return quote

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            user = self.context['request'].user
            instance.items.all().delete()

            for item_data in items_data:
                sub_item_id = item_data.get('price_sub_item')
                sub_item = None

                if sub_item_id:
                    try:
                        sub_item = PriceSubItem.objects.get(
                            id=sub_item_id, item__user=user
                        )
                    except PriceSubItem.DoesNotExist:
                        raise serializers.ValidationError(
                            {'items': f'PriceSubItem {sub_item_id} no encontrado.'}
                        )

                description = item_data.get('description') or (sub_item.description if sub_item else '')
                unit_price = item_data.get('unit_price')
                if unit_price is None:
                    unit_price = sub_item.net_value if sub_item else 0

                QuoteItem.objects.create(
                    quote=instance,
                    price_sub_item=sub_item,
                    description=description,
                    quantity=item_data['quantity'],
                    unit_price=unit_price,
                )

            instance.recalculate_totals()
        return instance
