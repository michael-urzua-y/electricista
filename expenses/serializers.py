from rest_framework import serializers
from .models import Expense
import magic


class ExpenseListSerializer(serializers.ModelSerializer):
    """Serializer para listado de gastos (sin datos binarios)."""

    created_by_name = serializers.CharField(
        source='created_by.username', read_only=True
    )
    tiene_comprobante = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = [
            'id',
            'date',
            'detail',
            'total_amount',
            'document_number',
            'document_type',
            'provider',
            'observations',
            'is_company_invoice',
            'file_name',
            'file_type',
            'tiene_comprobante',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_tiene_comprobante(self, obj):
        return bool(obj.file_data)


class ExpenseCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer para creación/edición de gastos con manejo de archivo."""

    file = serializers.FileField(required=False, write_only=True)

    class Meta:
        model = Expense
        fields = [
            'date',
            'detail',
            'total_amount',
            'document_number',
            'document_type',
            'provider',
            'observations',
            'is_company_invoice',
            'file',
        ]

    def validate_file(self, value):
        """Validar tipo MIME real y tamaño del archivo."""
        if value is None:
            return value

        # Límite de 10 MB
        max_size = 10 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError(
                f'El archivo no puede superar 10MB. '
                f'Tamaño actual: {value.size / 1024 / 1024:.2f}MB'
            )

        # Validar tipo MIME real con python-magic
        file_header = value.read(2048)
        value.seek(0)
        mime_type = magic.from_buffer(file_header, mime=True)
        allowed_mimes = ['application/pdf', 'image/jpeg', 'image/png']

        if mime_type not in allowed_mimes:
            raise serializers.ValidationError(
                f'Tipo de archivo no permitido. Se detectó: {mime_type}. '
                f'Formatos permitidos: PDF, PNG, JPG/JPEG.'
            )

        return value

    def validate_total_amount(self, value):
        """Validar que el monto sea positivo."""
        if value <= 0:
            raise serializers.ValidationError(
                'El monto total debe ser mayor a cero.'
            )
        return value
