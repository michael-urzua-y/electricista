"""
Serializers para las respuestas de comparación de precios entre facturas.

Usan rest_framework.serializers.Serializer (no ModelSerializer) ya que
serializan resultados calculados, no instancias de modelos.
"""
from rest_framework import serializers


class ProductoComparacionSerializer(serializers.Serializer):
    """Serializa un producto común con sus precios y variación."""
    producto_id = serializers.IntegerField()
    producto_nombre = serializers.CharField()
    precio_anterior = serializers.DecimalField(max_digits=10, decimal_places=2)
    precio_actual = serializers.DecimalField(max_digits=10, decimal_places=2)
    diferencia = serializers.DecimalField(max_digits=10, decimal_places=2)
    variacion_porcentual = serializers.DecimalField(
        max_digits=8, decimal_places=2, allow_null=True
    )


class FacturaMetaSerializer(serializers.Serializer):
    """Serializa metadatos básicos de una factura."""
    id = serializers.IntegerField()
    numero = serializers.CharField(allow_null=True)
    fecha_emision = serializers.DateField()
    proveedor = serializers.CharField(allow_null=True)


class ComparacionAutomaticaSerializer(serializers.Serializer):
    """Serializa la respuesta de comparación automática o manual."""
    factura_actual = FacturaMetaSerializer()
    factura_anterior = FacturaMetaSerializer(allow_null=True)
    productos_comunes = ProductoComparacionSerializer(many=True)
    mensaje = serializers.CharField(allow_null=True)


class ComparacionMensualProductoSerializer(serializers.Serializer):
    """Serializa estadísticas de un producto en el período mensual."""
    producto_id = serializers.IntegerField()
    producto_nombre = serializers.CharField()
    precio_minimo = serializers.DecimalField(max_digits=10, decimal_places=2)
    precio_maximo = serializers.DecimalField(max_digits=10, decimal_places=2)
    precio_promedio = serializers.DecimalField(max_digits=10, decimal_places=2)
    variacion_porcentual = serializers.DecimalField(
        max_digits=8, decimal_places=2, allow_null=True
    )


class FacturaMensualMetaSerializer(serializers.Serializer):
    """Serializa metadatos de factura para el resumen mensual."""
    id = serializers.IntegerField()
    numero = serializers.CharField(allow_null=True)
    fecha_emision = serializers.DateField()


class PeriodoSerializer(serializers.Serializer):
    """Serializa el período de comparación mensual."""
    year = serializers.IntegerField()
    month = serializers.IntegerField()


class ComparacionMensualSerializer(serializers.Serializer):
    """Serializa la respuesta de comparación mensual."""
    proveedor = serializers.CharField()
    periodo = PeriodoSerializer()
    facturas = FacturaMensualMetaSerializer(many=True)
    productos = ComparacionMensualProductoSerializer(many=True)
    mensaje = serializers.CharField(allow_null=True)
