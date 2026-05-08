"""
Serializers para el módulo de clientes.
"""
from rest_framework import serializers
from .models import Client, ClientSettings
from .validators import RutValidator


class ClientListSerializer(serializers.ModelSerializer):
    """
    Serializer ligero para listados de clientes.
    Incluye campos anotados: last_quote_date, total_approved.
    """
    last_quote_date = serializers.DateTimeField(read_only=True, allow_null=True)
    total_approved = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True, allow_null=True
    )

    class Meta:
        model = Client
        fields = [
            'id', 'rut', 'name', 'email', 'phone',
            'is_active', 'last_quote_date', 'total_approved',
        ]
        read_only_fields = fields


class ClientSerializer(serializers.ModelSerializer):
    """
    Serializer completo para crear/editar clientes.
    El campo rut es de solo lectura en actualizaciones.
    """
    rut = serializers.CharField(validators=[RutValidator()])

    class Meta:
        model = Client
        fields = [
            'id', 'rut', 'name', 'email', 'phone', 'address',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        # Verificar unicidad (user, rut) — el user se inyecta en perform_create/update
        request = self.context.get('request')
        if request and request.user:
            rut = attrs.get('rut', getattr(self.instance, 'rut', None))
            qs = Client.objects.filter(user=request.user, rut=rut)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'rut': 'Ya existe un cliente con este RUT.'})
        return attrs

    def update(self, instance, validated_data):
        # El RUT es inmutable una vez creado
        validated_data.pop('rut', None)
        return super().update(instance, validated_data)


class ClientSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientSettings
        fields = ['id', 'inactivity_days']
        read_only_fields = ['id']
