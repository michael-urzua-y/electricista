from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal, ROUND_HALF_UP


class CompanyProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='company_profile')
    name = models.CharField(max_length=200, verbose_name='Nombre empresa')
    rut = models.CharField(max_length=12, verbose_name='RUT')
    address = models.CharField(max_length=300, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(verbose_name='Email empresa')
    # Logo como binario (más eficiente que base64)
    logo_data = models.BinaryField(blank=True, null=True, verbose_name='Logo (binario)')
    logo_mime = models.CharField(max_length=20, blank=True, default='', verbose_name='MIME del logo')
    logo_size = models.PositiveIntegerField(blank=True, null=True, verbose_name='Tamaño del logo (bytes)')
    # Campo legacy mantenido para compatibilidad durante migración
    logo_base64 = models.TextField(blank=True, default='', verbose_name='Logo legacy (base64)')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Perfil de Empresa'

    @property
    def is_complete(self):
        return bool(self.name and self.rut and self.email)

    @property
    def has_logo(self):
        return bool(self.logo_data) or bool(self.logo_base64)

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
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotes',
        verbose_name='Cliente',
    )
    quote_number = models.CharField(max_length=10, unique=True, verbose_name='Número cotización')
    client_name = models.CharField(max_length=200, blank=True, default='')
    client_rut = models.CharField(max_length=12, blank=True, default='')
    client_email = models.EmailField(blank=True, default='')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft', db_index=True)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        verbose_name='Porcentaje de descuento',
    )
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
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
        """Recalcula todos los montos de la cotización."""
        TWO_PLACES = Decimal('0.01')
        subtotal = sum(item.line_total for item in self.items.all())
        self.subtotal = subtotal.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

        self.discount_amount = (
            self.subtotal * (self.discount_percentage / Decimal('100'))
        ).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

        self.total = (self.subtotal - self.discount_amount).quantize(
            TWO_PLACES, rounding=ROUND_HALF_UP
        )

        self.tax_amount = (self.total * Decimal('0.19')).quantize(
            TWO_PLACES, rounding=ROUND_HALF_UP
        )

        self.total_amount = (self.total + self.tax_amount).quantize(
            TWO_PLACES, rounding=ROUND_HALF_UP
        )

        self.save(update_fields=[
            'subtotal', 'discount_amount', 'total', 'tax_amount', 'total_amount'
        ])

    def __str__(self):
        return f"{self.quote_number} - {self.client_name or 'Sin cliente'}"


class QuoteEmailLog(models.Model):
    STATUS_CHOICES = [
        ('success', 'Exitoso'),
        ('failed', 'Fallido'),
    ]

    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name='email_logs')
    sent_at = models.DateTimeField(auto_now_add=True)
    recipient = models.EmailField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    error_message = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-sent_at']
        verbose_name = 'Registro de Envío de Email'

    def __str__(self):
        return f"{self.quote.quote_number} → {self.recipient} [{self.status}]"


class QuoteItem(models.Model):
    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name='items')
    price_sub_item = models.ForeignKey(
        'prices.PriceSubItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Sub-Ítem de Precio',
    )
    description = models.CharField(max_length=500, verbose_name='Descripción (snapshot)')
    quantity = models.DecimalField(max_digits=12, decimal_places=2)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        ordering = ['id']

    def save(self, *args, **kwargs):
        self.line_total = (self.quantity * self.unit_price).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.description} x{self.quantity}"
