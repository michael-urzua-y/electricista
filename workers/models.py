from django.db import models
from django.conf import settings
from decimal import Decimal, ROUND_HALF_UP


# Valor UTM 2026
UTM_VALUE = Decimal('67294')


class Worker(models.Model):
    """Modelo para trabajadores de la empresa."""

    HEALTH_SYSTEM_FONASA = 'fonasa'
    HEALTH_SYSTEM_ISAPRE = 'isapre'
    HEALTH_SYSTEM_CHOICES = [
        (HEALTH_SYSTEM_FONASA, 'Fonasa'),
        (HEALTH_SYSTEM_ISAPRE, 'Isapre'),
    ]

    HEALTH_PLAN_MANUAL = 'manual'
    HEALTH_PLAN_UF = 'uf'
    HEALTH_PLAN_CLP = 'clp'
    HEALTH_PLAN_UNIT_CHOICES = [
        (HEALTH_PLAN_MANUAL, 'Adicional manual'),
        (HEALTH_PLAN_UF, 'Plan en UF'),
        (HEALTH_PLAN_CLP, 'Plan en pesos'),
    ]

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
    health_system = models.CharField(
        max_length=10,
        choices=HEALTH_SYSTEM_CHOICES,
        default=HEALTH_SYSTEM_FONASA,
        verbose_name='Sistema de salud',
    )
    health_plan_unit = models.CharField(
        max_length=10,
        choices=HEALTH_PLAN_UNIT_CHOICES,
        default=HEALTH_PLAN_MANUAL,
        verbose_name='Tipo de plan de salud',
    )
    health_plan_uf = models.DecimalField(
        max_digits=8, decimal_places=4, default=Decimal('0'),
        verbose_name='Plan salud UF',
    )
    health_plan_clp = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0'),
        verbose_name='Plan salud pesos',
    )
    health_uf_value = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal('0'),
        verbose_name='Valor UF salud',
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

    @staticmethod
    def _round_peso(amount):
        return amount.quantize(Decimal('1'), rounding=ROUND_HALF_UP)

    @property
    def total_deductions_rate(self):
        """Tasa total de descuentos (AFP + Salud + Cesantía)."""
        return self.afp_rate + self.health_rate + self.unemployment_rate

    @property
    def afp_amount(self):
        """Cotización AFP sobre base imponible."""
        return self._round_peso(self.taxable_base * self.afp_rate / Decimal('100'))

    @property
    def health_legal_amount(self):
        """Cotización legal de salud, normalmente 7% de la base imponible."""
        return self._round_peso(self.taxable_base * self.health_rate / Decimal('100'))

    @property
    def health_plan_amount(self):
        """Valor pactado del plan de salud cuando la persona está en Isapre."""
        if self.health_system != self.HEALTH_SYSTEM_ISAPRE:
            return Decimal('0')

        if self.health_plan_unit == self.HEALTH_PLAN_UF:
            return self._round_peso(self.health_plan_uf * self.health_uf_value)

        if self.health_plan_unit == self.HEALTH_PLAN_CLP:
            return self._round_peso(self.health_plan_clp)

        return self.health_legal_amount + self._round_peso(self.additional_health)

    @property
    def health_additional_amount(self):
        """Diferencia adicional cuando el plan Isapre supera la cotización legal."""
        if self.health_system != self.HEALTH_SYSTEM_ISAPRE:
            return Decimal('0')

        if self.health_plan_unit in [self.HEALTH_PLAN_UF, self.HEALTH_PLAN_CLP]:
            return max(self.health_plan_amount - self.health_legal_amount, Decimal('0'))

        return self._round_peso(self.additional_health)

    @property
    def health_total_amount(self):
        """Total descontado por salud: 7% legal más adicional Isapre si aplica."""
        return self.health_legal_amount + self.health_additional_amount

    @property
    def unemployment_amount(self):
        """Seguro de cesantía de cargo del trabajador."""
        return self._round_peso(
            self.taxable_base * self.unemployment_rate / Decimal('100')
        )

    @property
    def deductions_amount(self):
        """Monto total de descuentos previsionales sobre base imponible."""
        return self.afp_amount + self.health_total_amount + self.unemployment_amount

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
        """Total descuentos = previsionales, salud completa e impuesto."""
        return self.deductions_amount + self.tax_amount

    @property
    def net_salary(self):
        """Sueldo líquido = total haberes - total descuentos."""
        return self.total_earnings - self.total_deductions
