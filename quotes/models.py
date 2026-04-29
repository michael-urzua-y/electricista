from django.db import models
from django.conf import settings
from decimal import Decimal, ROUND_HALF_UP


class CompanyProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='company_profile')
    name = models.CharField(max_length=200, verbose_name='Nombre empresa')
    rut = models.CharField(max_length=12, verbose_name='RUT')
    address = models.CharField(max_length=300, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(verbose_name='Email empresa')
    logo_base64 = models.TextField(blank=True, default='', verbose_name='Logo (base64 PNG/JPEG, máx 2 MB)')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Perfil de Empresa'

    @property
    def is_complete(self):
        return bool(self.name and self.rut and self.email)

    def __str__(self):
        return f"{self.name} ({self.rut})"


class Quote(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Borrador'),
        ('sent', 'Enviada'),
        ('approved', 'Aprobada'),
        ('rejected', 'Rechazada'),
    ]

    ALLOWED_TRANSITIONS = {
        'draft': ['sent'],
        'sent': ['approved', 'rejected'],
        'approved': [],
        'rejected': [],
    }

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='quotes')
    quote_number = models.CharField(max_length=10, unique=True, verbose_name='Número cotización')
    client_name = models.CharField(max_length=200, blank=True, default='')
    client_rut = models.CharField(max_length=12, blank=True, default='')
    client_email = models.EmailField(blank=True, default='')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft', db_index=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes = models.TextField(blank=True, default='')
    valid_until = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    status_updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Cotización'
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['user', 'created_at']),
        ]

    def recalculate_totals(self):
        subtotal = sum(item.line_total for item in self.items.all())
        tax = (subtotal * Decimal('0.19')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        self.subtotal = subtotal
        self.tax_amount = tax
        self.total_amount = subtotal + tax
        self.save(update_fields=['subtotal', 'tax_amount', 'total_amount'])

    def __str__(self):
        return f"{self.quote_number} - {self.client_name or 'Sin cliente'}"


class QuoteItem(models.Model):
    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey('products.Product', on_delete=models.SET_NULL, null=True, blank=True)
    product_name = models.CharField(max_length=300, verbose_name='Nombre producto (snapshot)')
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit = models.CharField(max_length=20, default='unidad')
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=14, decimal_places=2)
    provider_inventory_id = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name='ID Inventario Proveedor'
    )
    provider_id = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name='ID Proveedor'
    )

    class Meta:
        ordering = ['id']

    def save(self, *args, **kwargs):
        self.line_total = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product_name} x{self.quantity}"
