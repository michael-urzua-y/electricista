from django.db import models


UNIT_CHOICES = [
    ('unidad', 'Unidad'),
    ('metro', 'Metro'),
    ('rollo', 'Rollo'),
    ('caja', 'Caja'),
    ('kg', 'Kilogramo'),
    ('litro', 'Litro'),
]


class Provider(models.Model):
    """Modelo para proveedores de materiales"""
    CATEGORY_CHOICES = [
        ('electricidad', 'Electricidad'),
        ('construccion', 'Construcción'),
        ('fontaneria', 'Fontanería'),
        ('herramientas', 'Herramientas'),
        ('general', 'General'),
    ]

    name = models.CharField(max_length=200, verbose_name='Nombre')
    website = models.URLField(blank=True, null=True, verbose_name='Sitio web')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='general', verbose_name='Categoría')
    logo_url = models.URLField(blank=True, null=True, verbose_name='Logo URL')
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Proveedor'
        verbose_name_plural = 'Proveedores'

    def __str__(self):
        return self.name


class Product(models.Model):
    """Modelo para productos de materiales eléctricos/construcción"""
    name = models.CharField(max_length=300, verbose_name='Nombre')
    description = models.TextField(blank=True, null=True, verbose_name='Descripción')
    brand = models.CharField(max_length=100, blank=True, null=True, verbose_name='Marca')
    model = models.CharField(max_length=100, blank=True, null=True, verbose_name='Modelo')
    provider = models.ForeignKey(Provider, on_delete=models.SET_NULL, blank=True, null=True, related_name='products', verbose_name='Proveedor')
    category = models.CharField(max_length=50, blank=True, null=True, verbose_name='Categoría')
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default='unidad', blank=True, verbose_name='Unidad')
    stock = models.DecimalField(
        max_digits=12, decimal_places=3,
        default=0, verbose_name='Stock disponible'
    )
    image_url = models.URLField(blank=True, null=True, verbose_name='Imagen URL')
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'

    def __str__(self):
        return f"{self.name} ({self.brand or 'Sin marca'})"


class PriceHistory(models.Model):
    """Historial de precios por proveedor"""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='price_history', verbose_name='Producto')
    provider = models.ForeignKey(Provider, on_delete=models.CASCADE, verbose_name='Proveedor')
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Precio')
    currency = models.CharField(max_length=3, default='CLP', verbose_name='Moneda')
    recorded_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha registro')
    source_url = models.URLField(blank=True, null=True, verbose_name='Fuente URL')

    class Meta:
        ordering = ['-recorded_at']
        verbose_name = 'Historial de Precio'
        verbose_name_plural = 'Historial de Precios'

    def __str__(self):
        return f"{self.product.name} - {self.provider.name}: ${self.price}"
