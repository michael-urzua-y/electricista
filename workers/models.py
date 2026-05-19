from django.db import models
from django.conf import settings
from decimal import Decimal, ROUND_HALF_UP


# Valor UTM 2026
UTM_VALUE = Decimal('67294')


class Worker(models.Model):
    """Modelo para trabajadores de la empresa."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='workers',
        verbose_name='Usuario',
    )
    name = models.CharField(max_length=200, verbose_name='Nombre')
    rut = models.CharField(max_length=12, blank=True, null=True, verbose_name='RUT')
    position = models.CharField(
        max_length=200, blank=True, null=True, verbose_name='Cargo'
    )
    gross_salary = models.DecimalField(
        max_digits=12, decimal_places=2, verbose_name='Sueldo Bruto'
    )
    gratification = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0'),
        verbose_name='Gratificación'
    )
    meal_allowance = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0'),
        verbose_name='Colación'
    )
    transport_allowance = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0'),
        verbose_name='Movilización'
    )
    other_allowance = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0'),
        verbose_name='Otras asignaciones'
    )
    additional_health = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0'),
        verbose_name='Adicional Salud (Isapre)'
    )
    afp_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('10.69'),
        verbose_name='% AFP'
    )
    health_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('7.00'),
        verbose_name='% Salud'
    )
    unemployment_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('0.60'),
        verbose_name='% Seguro Cesantía'
    )
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Trabajador'
        verbose_name_plural = 'Trabajadores'

    def __str__(self):
        return f"{self.name} - {self.position or 'Sin cargo'}"

    @property
    def taxable_base(self):
        """Base imponible = sueldo bruto + gratificación."""
        return self.gross_salary + self.gratification

    @property
    def total_deductions_rate(self):
        """Tasa total de descuentos (AFP + Salud + Cesantía)."""
        return self.afp_rate + self.health_rate + self.unemployment_rate

    @property
    def deductions_amount(self):
        """Monto total de descuentos previsionales sobre base imponible."""
        return (self.taxable_base * self.total_deductions_rate / Decimal('100')).quantize(
            Decimal('1'), rounding=ROUND_HALF_UP
        )

    @property
    def taxable_income(self):
        """Base tributable (base imponible - descuentos previsionales)."""
        return self.taxable_base - self.deductions_amount

    @property
    def tax_amount(self):
        """Impuesto único de segunda categoría (tramos simplificados Chile 2026)."""
        taxable = self.taxable_income
        # Convertir a UTM
        taxable_utm = taxable / UTM_VALUE

        # Tramos impuesto único 2da categoría (simplificado)
        # 0 - 13.5 UTM: 0%
        # 13.5 - 30 UTM: 4%
        # 30 - 50 UTM: 8%
        # 50 - 70 UTM: 13.5%
        # 70 - 90 UTM: 23%
        # 90 - 120 UTM: 30.4%
        # 120+ UTM: 35%
        brackets = [
            (Decimal('13.5'), Decimal('0')),
            (Decimal('30'), Decimal('0.04')),
            (Decimal('50'), Decimal('0.08')),
            (Decimal('70'), Decimal('0.135')),
            (Decimal('90'), Decimal('0.23')),
            (Decimal('120'), Decimal('0.304')),
            (Decimal('9999'), Decimal('0.35')),
        ]

        tax = Decimal('0')
        prev_limit = Decimal('0')

        for limit, rate in brackets:
            if taxable_utm <= prev_limit:
                break
            taxable_in_bracket = min(taxable_utm, limit) - prev_limit
            tax += taxable_in_bracket * rate * UTM_VALUE
            prev_limit = limit

        return tax.quantize(Decimal('1'), rounding=ROUND_HALF_UP)

    @property
    def non_taxable_total(self):
        """Total haberes no imponibles (colación + movilización + otras)."""
        return self.meal_allowance + self.transport_allowance + self.other_allowance

    @property
    def total_earnings(self):
        """Total haberes = base imponible + no imponibles."""
        return self.taxable_base + self.non_taxable_total

    @property
    def total_deductions(self):
        """Total descuentos = previsionales + adicional salud + impuesto."""
        return self.deductions_amount + self.additional_health + self.tax_amount

    @property
    def net_salary(self):
        """Sueldo líquido = total haberes - total descuentos."""
        return self.total_earnings - self.total_deductions
