from decimal import Decimal, ROUND_HALF_UP
from django.db.models import Sum
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from quotes.models import Quote
from expenses.models import Expense
from workers.models import Worker

MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]


class TaxEstimatorView(APIView):
    """Estimador tributario mensual con soporte de mes/año seleccionable."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.localtime()

        # Soporte de mes/año por query param: ?month=5&year=2026
        try:
            query_month = int(request.query_params.get('month', now.month))
            query_year = int(request.query_params.get('year', now.year))
            if not (1 <= query_month <= 12):
                query_month = now.month
            if not (2020 <= query_year <= 2100):
                query_year = now.year
        except (ValueError, TypeError):
            query_month = now.month
            query_year = now.year

        current_month = query_month
        current_year = query_year
        is_current_month = (current_month == now.month and current_year == now.year)

        TWO_PLACES = Decimal('0.01')
        ZERO = Decimal('0')

        # --- VENTAS ---
        ventas_qs = Quote.objects.filter(
            user=user,
            status='approved',
            created_at__year=current_year,
            created_at__month=current_month,
        )
        ventas_count = ventas_qs.count()
        ventas_netas = ventas_qs.aggregate(total=Sum('total'))['total'] or ZERO
        iva_debito = (ventas_netas * Decimal('0.19')).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

        # --- COMPRAS ---
        compras_qs = Expense.objects.filter(
            is_company_invoice=True,
            date__year=current_year,
            date__month=current_month,
        )
        compras_count = compras_qs.count()
        compras_netas = compras_qs.aggregate(total=Sum('total_amount'))['total'] or ZERO
        iva_credito = (compras_netas * Decimal('0.19')).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

        # --- IMPUESTO DETERMINADO ---
        impuesto_determinado = max(iva_debito - iva_credito, ZERO)

        # --- PPM ---
        ppm_rate = Decimal('0.01')
        ppm = (ventas_netas * ppm_rate).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

        # --- RETENCIÓN 2DA CATEGORÍA ---
        honorarios_total = Expense.objects.filter(
            document_type='honorario',
            date__year=current_year,
            date__month=current_month,
        ).aggregate(total=Sum('total_amount'))['total'] or ZERO
        retencion_2da_categoria = (honorarios_total * Decimal('0.1375')).quantize(
            TWO_PLACES, rounding=ROUND_HALF_UP
        )

        # --- IMPUESTO TRABAJADORES ---
        active_workers = Worker.objects.filter(user=user, is_active=True)
        impuesto_trabajadores = sum(w.tax_amount for w in active_workers)

        # --- TOTALES ---
        total_impuesto = impuesto_determinado + ppm + retencion_2da_categoria + impuesto_trabajadores
        honorarios_contador = Decimal('127500')
        total_a_transferir = total_impuesto + honorarios_contador

        # --- FECHAS DE CORTE Y PAGO ---
        # El F29 se paga el mes siguiente (día 12 hábil aprox.)
        pago_month = current_month % 12 + 1
        pago_year = current_year + (1 if current_month == 12 else 0)
        mes_pago = f"{MESES[pago_month - 1]} {pago_year}"

        # Fecha de corte: día 10 del mes siguiente (con guía despacho) o día 5
        corte_con_guia = f"10 de {MESES[pago_month - 1]} {pago_year}"
        corte_sin_guia = f"5 de {MESES[pago_month - 1]} {pago_year}"

        periodo = f"{MESES[current_month - 1]} {current_year}"

        return Response({
            'periodo': periodo,
            'mes': current_month,
            'anio': current_year,
            'is_current_month': is_current_month,
            'mes_pago': mes_pago,
            'corte_con_guia': corte_con_guia,
            'corte_sin_guia': corte_sin_guia,
            'ventas_netas': str(ventas_netas),
            'ventas_count': ventas_count,
            'iva_debito': str(iva_debito),
            'compras_netas': str(compras_netas),
            'compras_count': compras_count,
            'iva_credito': str(iva_credito),
            'impuesto_determinado': str(impuesto_determinado),
            'ppm': str(ppm),
            'retencion_2da_categoria': str(retencion_2da_categoria),
            'impuesto_trabajadores': str(impuesto_trabajadores),
            'total_impuesto': str(total_impuesto),
            'honorarios_contador': str(honorarios_contador),
            'total_a_transferir': str(total_a_transferir),
        })


class AvailableMonthsView(APIView):
    """Retorna los meses que tienen datos (cotizaciones aprobadas o gastos con factura empresa)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import DateField
        from django.db.models.functions import TruncMonth
        from django.utils import timezone

        user = request.user
        now = timezone.localtime()

        # Meses con cotizaciones aprobadas
        quote_months = (
            Quote.objects
            .filter(user=user, status='approved')
            .annotate(month=TruncMonth('created_at', output_field=DateField()))
            .values_list('month', flat=True)
            .distinct()
        )

        # Meses con gastos con factura empresa
        expense_months = (
            Expense.objects
            .filter(is_company_invoice=True)
            .annotate(month=TruncMonth('date', output_field=DateField()))
            .values_list('month', flat=True)
            .distinct()
        )

        # Unir y deduplicar
        months_set = set()
        for d in quote_months:
            if d:
                months_set.add((d.year, d.month))
        for d in expense_months:
            if d:
                months_set.add((d.year, d.month))

        # Siempre incluir el mes actual
        months_set.add((now.year, now.month))

        # Solo meses <= mes actual
        current = (now.year, now.month)
        months_set = {m for m in months_set if m <= current}

        result = sorted(months_set, reverse=True)
        return Response([{'year': y, 'month': m} for y, m in result])
