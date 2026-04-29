from django.db import models
from django.conf import settings

UNIT_CHOICES = [
    ('unidad', 'Unidad'),
    ('metro', 'Metro'),
    ('rollo', 'Rollo'),
    ('caja', 'Caja'),
    ('kg', 'Kilogramo'),
    ('litro', 'Litro'),
]


class ProviderInventory(models.Model):
    """
    Inventario independiente por proveedor.
    Mantiene el stock de productos específicos de cada proveedor.
    """
    id = models.BigAutoField(primary_key=True)

    product_name = models.CharField(
        max_length=500,
        verbose_name='Nombre del producto',
        db_index=True,
        help_text='Nombre del producto tal como aparece en facturas'
    )
    provider = models.ForeignKey(
        'products.Provider',
        on_delete=models.CASCADE,
        related_name='inventory_items',
        verbose_name='Proveedor'
    )
    stock_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Cantidad en stock',
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Precio unitario',
        help_text='Precio más reciente del proveedor'
    )
    unit_measure = models.CharField(
        max_length=20,
        choices=UNIT_CHOICES,
        default='unidad',
        verbose_name='Unidad de medida'
    )
    last_updated = models.DateTimeField(auto_now=True, verbose_name='Última actualización')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha creación')
    last_invoice_id = models.BigIntegerField(null=True, blank=True, verbose_name='ID de última factura procesada')

    class Meta:
        unique_together = [('product_name', 'provider')]
        indexes = [
            models.Index(fields=['product_name', 'provider']),
            models.Index(fields=['provider', 'stock_quantity']),
            models.Index(fields=['product_name']),
            models.Index(fields=['last_updated']),
        ]
        verbose_name = 'Inventario de Proveedor'
        verbose_name_plural = 'Inventarios de Proveedores'

    def __str__(self):
        return f"{self.product_name} - {self.provider.name}"


class ProviderInventoryAuditLog(models.Model):
    """
    Registro inmutable de todos los cambios en ProviderInventory.
    """
    ACTION_CHOICES = [
        ('increment', 'Incremento (Factura)'),
        ('decrement', 'Decremento (Cotización)'),
        ('adjustment', 'Ajuste (Modificación)'),
        ('restore', 'Restauración (Cancelación)'),
        ('manual', 'Manual (Usuario)'),
    ]
    SOURCE_CHOICES = [
        ('invoice', 'Factura'),
        ('quote', 'Cotización'),
        ('manual', 'Manual'),
        ('system', 'Sistema'),
    ]

    id = models.BigAutoField(primary_key=True)
    inventory = models.ForeignKey(
        ProviderInventory,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        verbose_name='Inventario'
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, verbose_name='Acción')
    quantity_before = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='Cantidad antes')
    quantity_after = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='Cantidad después')
    quantity_changed = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='Cantidad cambiada')
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, verbose_name='Origen')
    invoice_id = models.BigIntegerField(null=True, blank=True, verbose_name='ID Factura')
    quote_id = models.BigIntegerField(null=True, blank=True, verbose_name='ID Cotización')
    quote_item_id = models.BigIntegerField(null=True, blank=True, verbose_name='ID Ítem Cotización')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_audit_logs',
        verbose_name='Usuario'
    )
    notes = models.TextField(blank=True, default='', verbose_name='Notas')
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Timestamp')

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['inventory', 'timestamp']),
            models.Index(fields=['source', 'timestamp']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['invoice_id']),
            models.Index(fields=['quote_id']),
        ]
        verbose_name = 'Auditoría de Inventario'
        verbose_name_plural = 'Auditorías de Inventario'

    def __str__(self):
        return f"{self.action} - {self.inventory.product_name} ({self.timestamp})"
