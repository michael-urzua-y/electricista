from django.db import models
from django.conf import settings


class Expense(models.Model):
    """Modelo para gastos generales de la empresa."""

    DOCUMENT_TYPE_CHOICES = [
        ('boleta', 'Boleta'),
        ('factura', 'Factura'),
        ('factura_exenta', 'Factura exenta'),
        ('honorario', 'Honorario'),
        ('recibo', 'Recibo'),
        ('voucher', 'Voucher'),
        ('otro', 'Otro'),
    ]

    date = models.DateField(verbose_name='Fecha', db_index=True)
    detail = models.CharField(max_length=500, verbose_name='Detalle')
    total_amount = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name='Monto Total'
    )
    document_number = models.CharField(
        max_length=100, blank=True, null=True, verbose_name='N° Documento'
    )
    document_type = models.CharField(
        max_length=20,
        choices=DOCUMENT_TYPE_CHOICES,
        blank=True,
        null=True,
        verbose_name='Tipo Documento',
    )
    provider = models.CharField(
        max_length=200, blank=True, null=True, verbose_name='Proveedor'
    )
    observations = models.TextField(
        blank=True, null=True, verbose_name='Observaciones'
    )
    is_company_invoice = models.BooleanField(
        default=False, verbose_name='Factura con RUT empresa'
    )

    # Almacenamiento binario del comprobante (mismo patrón que Invoice)
    file_data = models.BinaryField(
        blank=True, null=True, verbose_name='Datos del archivo'
    )
    file_name = models.CharField(
        max_length=255, blank=True, null=True, verbose_name='Nombre original'
    )
    file_type = models.CharField(
        max_length=10, blank=True, null=True, verbose_name='Tipo archivo'
    )
    file_size = models.PositiveIntegerField(
        blank=True, null=True, verbose_name='Tamaño (bytes)'
    )

    # Auditoría
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='expenses',
        verbose_name='Creado por',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name = 'Gasto'
        verbose_name_plural = 'Gastos'
        indexes = [
            models.Index(fields=['-date', '-created_at']),
            models.Index(fields=['document_type']),
        ]

    def __str__(self):
        return f"{self.date} - {self.detail[:50]} - ${self.total_amount}"
