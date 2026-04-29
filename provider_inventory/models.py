from django.db import models
from django.conf import settings
from decimal import Decimal

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
    
    # Identificación del producto
    product_name = models.CharField(
        max_length=500,
        verbose_name='Nombre del producto',
        db_index=True,
        help_text='Nombre del producto tal como aparece en facturas'
    )
    
    # Relación con proveedor
    provider = models.ForeignKey(
        'products.Provider',
        on_delete=models.CASCADE,
        related_name='inventory_items',
        verbose_name='Proveedor'
    )
    
    # Stock
    stock_quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        verbose_name='Cantidad en stock',
        help_text='Cantidad disponible del producto'
    )
    
    # Precio
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Precio unitario',
        help_text='Precio más reciente del proveedor'
    )
    
    # Unidad de medida
    unit_measure = models.CharField(
        max_length=20,
        choices=UNIT_CHOICES,
        default='unidad',
        verbose_name='Unidad de medida'
    )
    
    # Auditoría
    last_updated = models.DateTimeField(
        auto_now=True,
        verbose_name='Última actualización'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Fecha creación'
    )
    
    # Metadata
    last_invoice_id = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name='ID de última factura procesada'
    )
    
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
    Permite auditoría completa y resolución de discrepancias.
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
    
    # Referencia al inventario
    inventory = models.ForeignKey(
        ProviderInventory,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        verbose_name='Inventario'
    )
    
    # Acción
    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES,
        verbose_name='Acción'
    )
    
    # Valores
    quantity_before = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Cantidad antes'
    )
    quantity_after = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Cantidad después'
    )
    quantity_changed = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Cantidad cambiada'
    )
    
    # Origen
    source = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES,
        verbose_name='Origen'
    )
    
    # Referencias
    invoice_id = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name='ID Factura'
    )
    quote_id = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name='ID Cotización'
    )
    quote_item_id = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name='ID Ítem Cotización'
    )
    
    # Usuario
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_audit_logs',
        verbose_name='Usuario'
    )
    
    # Metadata
    notes = models.TextField(
        blank=True,
        default='',
        verbose_name='Notas'
    )
    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name='Timestamp'
    )
    
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


class StockReservation(models.Model):
    """
    Reserva de stock para cotizaciones.
    Mantiene el stock reservado hasta que la cotización sea aprobada o rechazada.
    """
    STATUS_CHOICES = [
        ('reserved', 'Reservado'),
        ('approved', 'Aprobado'),
        ('rejected', 'Rechazado'),
        ('cancelled', 'Cancelado'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    
    # Referencia a cotización
    quote = models.ForeignKey(
        'quotes.Quote',
        on_delete=models.CASCADE,
        related_name='stock_reservations',
        verbose_name='Cotización'
    )
    
    # Referencia a ítem de cotización
    quote_item = models.ForeignKey(
        'quotes.QuoteItem',
        on_delete=models.CASCADE,
        related_name='stock_reservations',
        verbose_name='Ítem Cotización'
    )
    
    # Inventario reservado
    inventory = models.ForeignKey(
        ProviderInventory,
        on_delete=models.CASCADE,
        related_name='reservations',
        verbose_name='Inventario'
    )
    
    # Cantidad reservada
    quantity_reserved = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Cantidad reservada'
    )
    
    # Estado
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='reserved',
        verbose_name='Estado'
    )
    
    # Auditoría
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Fecha creación'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='Última actualización'
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['quote', 'status']),
            models.Index(fields=['inventory', 'status']),
        ]
        verbose_name = 'Reserva de Stock'
        verbose_name_plural = 'Reservas de Stock'
    
    def __str__(self):
        return f"Reserva {self.id} - {self.inventory.product_name}"


class ProviderInventoryPriceHistory(models.Model):
    """
    Historial de precios para cada (product_name, provider).
    Permite rastrear cambios de precio y usar el más reciente en cotizaciones.
    """
    id = models.BigAutoField(primary_key=True)
    
    # Referencia al inventario
    inventory = models.ForeignKey(
        ProviderInventory,
        on_delete=models.CASCADE,
        related_name='price_history',
        verbose_name='Inventario'
    )
    
    # Precio
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name='Precio unitario'
    )
    
    # Origen
    source = models.CharField(
        max_length=20,
        choices=[
            ('invoice', 'Factura'),
            ('manual', 'Manual'),
        ],
        verbose_name='Origen'
    )
    
    # Referencia
    invoice_id = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name='ID Factura'
    )
    
    # Auditoría
    recorded_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name='Fecha registro'
    )
    
    class Meta:
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['inventory', 'recorded_at']),
        ]
        verbose_name = 'Historial de Precio'
        verbose_name_plural = 'Historiales de Precios'
    
    def __str__(self):
        return f"{self.inventory.product_name} - ${self.unit_price}"
