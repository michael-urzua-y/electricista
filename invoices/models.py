import os
from django.db import models
from django.conf import settings
from products.models import Product


def invoice_upload_path(instance, filename):
    """Ruta de subida para facturas: invoices/user_id/filename"""
    return f'invoices/user_{instance.user.id}/{filename}'


class Invoice(models.Model):
    """Modelo para facturas subidas por usuarios"""
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('processing', 'Procesando'),
        ('completed', 'Completada'),
        ('failed', 'Fallida'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='invoices', verbose_name='Usuario')
    provider = models.ForeignKey('products.Provider', on_delete=models.SET_NULL, blank=True, null=True, related_name='invoices', verbose_name='Proveedor')
    invoice_number = models.CharField(max_length=100, blank=True, null=True, verbose_name='Número de factura')
    issue_date = models.DateField(verbose_name='Fecha emisión', null=True, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, verbose_name='Monto total')
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, verbose_name='Impuestos')
    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, verbose_name='Subtotal')
    markup_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name='Margen de ganancia general (%)')
    currency = models.CharField(max_length=3, default='CLP', verbose_name='Moneda')
    # Almacenamiento binario en BD (más eficiente)
    file_data = models.BinaryField(blank=True, null=True, verbose_name='Datos del archivo')
    file_name = models.CharField(max_length=255, blank=True, null=True, verbose_name='Nombre original')
    file_type = models.CharField(max_length=10, blank=True, null=True, verbose_name='Tipo archivo')
    file_size = models.PositiveIntegerField(blank=True, null=True, verbose_name='Tamaño (bytes)')
    ocr_text = models.TextField(blank=True, null=True, verbose_name='Texto OCR extraído')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='Estado')
    processing_notes = models.TextField(blank=True, null=True, verbose_name='Notas procesamiento')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issue_date']
        verbose_name = 'Factura'
        verbose_name_plural = 'Facturas'

    def __str__(self):
        return f"Factura {self.invoice_number or self.id} - {self.user.username}"

    def get_file_extension(self):
        if self.file:
            return os.path.splitext(self.file.name)[1].lower()
        return ''


class InvoiceItem(models.Model):
    """Ítems de una factura"""
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items', verbose_name='Factura')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, blank=True, null=True, related_name='invoice_items', verbose_name='Producto')
    description = models.CharField(max_length=500, verbose_name='Descripción')
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1, verbose_name='Cantidad')
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name='Precio unitario')
    total_price = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name='Precio total')
    markup_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0, verbose_name='Ganancia (%)')
    unit_measure = models.CharField(max_length=20, blank=True, null=True, verbose_name='Unidad de medida')
    confidence = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True, verbose_name='Confianza extracción (%)')
    needs_review = models.BooleanField(default=False, verbose_name='Requiere revisión')
    notes = models.TextField(blank=True, null=True, verbose_name='Notas')

    class Meta:
        ordering = ['id']
        verbose_name = 'Ítem de Factura'
        verbose_name_plural = 'Ítems de Facturas'

    @property
    def sell_price(self):
        """Calcula el valor a cobrar (Costo + Margen)"""
        if self.unit_price is not None:
            from decimal import Decimal
            margin = (self.unit_price * self.markup_percentage) / Decimal('100')
            return self.unit_price + margin
        return None

    def __str__(self):
        return f"{self.description[:50]} - {self.quantity} x ${self.unit_price}"
