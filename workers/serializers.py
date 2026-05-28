from decimal import Decimal

from rest_framework import serializers
from .models import Worker


class WorkerSerializer(serializers.ModelSerializer):
    """Serializer para trabajadores con campos calculados."""

    afp_amount = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )
    health_legal_amount = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )
    health_plan_amount = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )
    health_additional_amount = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )
    health_total_amount = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )
    unemployment_amount = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )
    taxable_base = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )
    total_deductions_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True
    )
    deductions_amount = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )
    taxable_income = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )
    tax_amount = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )
    non_taxable_total = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )
    total_earnings = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )
    total_deductions = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )
    net_salary = serializers.DecimalField(
        max_digits=12, decimal_places=0, read_only=True
    )

    class Meta:
        model = Worker
        fields = [
            'id',
            'name',
            'rut',
            'position',
            'gross_salary',
            'gratification',
            'meal_allowance',
            'transport_allowance',
            'other_allowance',
            'additional_health',
            'health_system',
            'health_plan_unit',
            'health_plan_uf',
            'health_plan_clp',
            'health_uf_value',
            'afp_rate',
            'health_rate',
            'unemployment_rate',
            'is_active',
            'afp_amount',
            'health_legal_amount',
            'health_plan_amount',
            'health_additional_amount',
            'health_total_amount',
            'unemployment_amount',
            'taxable_base',
            'total_deductions_rate',
            'deductions_amount',
            'taxable_income',
            'tax_amount',
            'non_taxable_total',
            'total_earnings',
            'total_deductions',
            'net_salary',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        data = super().validate(attrs)
        instance = self.instance

        def value(name, default=None):
            if name in data:
                return data[name]
            if instance is not None:
                return getattr(instance, name)
            return default

        health_system = value('health_system', Worker.HEALTH_SYSTEM_FONASA)
        health_plan_unit = value('health_plan_unit', Worker.HEALTH_PLAN_MANUAL)
        data['health_rate'] = Decimal('7.00')

        if health_system == Worker.HEALTH_SYSTEM_FONASA:
            data['additional_health'] = Decimal('0')
            data['health_plan_unit'] = Worker.HEALTH_PLAN_UF

        if health_system == Worker.HEALTH_SYSTEM_ISAPRE:
            if health_plan_unit == Worker.HEALTH_PLAN_UF:
                if value('health_plan_uf', 0) <= 0:
                    raise serializers.ValidationError({
                        'health_plan_uf': 'Ingresa las UF del plan de Isapre.'
                    })
                if value('health_uf_value', 0) <= 0:
                    raise serializers.ValidationError({
                        'health_uf_value': 'Ingresa el valor UF usado en la liquidación.'
                    })
            elif health_plan_unit == Worker.HEALTH_PLAN_CLP:
                if value('health_plan_clp', 0) <= 0:
                    raise serializers.ValidationError({
                        'health_plan_clp': 'Ingresa el valor del plan de salud en pesos.'
                    })

        return data
