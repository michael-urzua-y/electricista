from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class Client(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='clients',
    )
    rut = models.CharField(max_length=12, verbose_name='RUT')
    name = models.CharField(max_length=200, verbose_name='Nombre')
    email = models.EmailField(blank=True, default='', verbose_name='Email')
    phone = models.CharField(max_length=20, blank=True, default='', verbose_name='Teléfono')
    address = models.CharField(max_length=300, blank=True, default='', verbose_name='Dirección')
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'
        unique_together = [('user', 'rut')]
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['user', 'name']),
        ]

    def __str__(self):
        return f"{self.name} ({self.rut})"


class ClientSettings(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='client_settings',
    )
    inactivity_days = models.PositiveIntegerField(
        default=90,
        validators=[MinValueValidator(1), MaxValueValidator(365)],
        verbose_name='Días de inactividad',
    )

    class Meta:
        verbose_name = 'Configuración de Clientes'
        verbose_name_plural = 'Configuraciones de Clientes'

    def __str__(self):
        return f"Configuración de {self.user} — {self.inactivity_days} días"
