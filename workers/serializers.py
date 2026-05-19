from rest_framework import serializers
from .models import Worker


class WorkerSerializer(serializers.ModelSerializer):
    """Serializer para trabajadores con campos calculados."""

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
            'afp_rate',
            'health_rate',
            'unemployment_rate',
            'is_active',
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
