"""
Modelos para el módulo de precios.
"""
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator


class PriceItem(models.Model):
    """Categoría principal de la lista de precios (ej: PUNTO DE RED, FIBRA ÓPTICA)."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='price_items',
    )
    order_number = models.PositiveIntegerField(verbose_name='Número de orden')
    name = models.CharField(max_length=200, verbose_name='Nombre')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Ítem de Precio'
        verbose_name_plural = 'Ítems de Precio'
        unique_together = [('user', 'order_number')]
        ordering = ['order_number']
        indexes = [
            models.Index(fields=['user', 'order_number']),
        ]

    def __str__(self):
        return f"{self.order_number}. {self.name}"


class PriceSubItem(models.Model):
    """Servicio individual dentro de un Ítem (ej: Cat 6 instalación, certificación)."""
    item = models.ForeignKey(
        PriceItem,
        on_delete=models.CASCADE,
        related_name='subitems',
    )
    sub_number = models.PositiveIntegerField(verbose_name='Número de sub-ítem')
    description = models.CharField(max_length=500, verbose_name='Descripción')
    net_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Valor Neto',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Sub-Ítem de Precio'
        verbose_name_plural = 'Sub-Ítems de Precio'
        unique_together = [('item', 'sub_number')]
        ordering = ['sub_number']
        indexes = [
            models.Index(fields=['item', 'sub_number']),
        ]

    @property
    def full_number(self):
        """Retorna el número compuesto (ej: 1.1, 2.3)."""
        return f"{self.item.order_number}.{self.sub_number}"

    def __str__(self):
        return f"{self.full_number} - {self.description}"
