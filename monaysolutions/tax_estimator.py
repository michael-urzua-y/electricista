from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from expenses.models import Expense
from invoices.models import Invoice
from quotes.models import Quote
from workers.models import Worker
from monaysolutions.config import (
    HONORARIOS_RETENTION_RATES,
    IVA_RATE,
    PPM_RATE,
    TAX_CUTOFF_WITH_GUIDE_DAY,
    TAX_CUTOFF_WITHOUT_GUIDE_DAY,
    TAX_ESTIMATOR_ACCOUNTANT_FEE,
    TAX_ESTIMATOR_RENTA_AT_AMOUNT,
    TAX_ESTIMATOR_RENTA_AT_MONTH,
    TAX_ESTIMATOR_RENTA_AT_YEAR,
    TWO_PLACES,
)


MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

ZERO = Decimal('0')


def _money(value):
    return str((value or ZERO).quantize(TWO_PLACES, rounding=ROUND_HALF_UP))


def _next_month(year, month):
    if month == 12:
        return year + 1, 1
    return year, month + 1


def _local_date(value):
    if not value:
        return None
    return timezone.localtime(value).date()


def _split_gross_amount(total):
    total = total or ZERO
    net = (total / (Decimal('1') + IVA_RATE)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    tax = (total - net).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    return net, tax, total


def _invoice_amounts(invoice):
    total = invoice.total_amount or ZERO
    subtotal = invoice.subtotal_amount
    tax = invoice.tax_amount

    if subtotal is not None and tax is not None:
        return subtotal, tax, total
    if subtotal is not None:
        return subtotal, (total - subtotal).quantize(TWO_PLACES, rounding=ROUND_HALF_UP), total
    if tax is not None:
        return (total - tax).quantize(TWO_PLACES, rounding=ROUND_HALF_UP), tax, total
    return _split_gross_amount(total)


def _quote_amounts(quote):
    net = quote.total or quote.subtotal or ZERO
    tax = quote.tax_amount or (net * IVA_RATE).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    total = quote.total_amount or (net + tax).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
    return net, tax, total


def _honorarios_retention_rate(year):
    return HONORARIOS_RETENTION_RATES.get(
        year,
        Decimal('0.1700') if year >= 2028 else Decimal('0.1375'),
    )


def _renta_at_fee(year, month):
    if year == TAX_ESTIMATOR_RENTA_AT_YEAR and month == TAX_ESTIMATOR_RENTA_AT_MONTH:
        return TAX_ESTIMATOR_RENTA_AT_AMOUNT
    return ZERO


def _quote_period_filter(year, month):
    return (
        Q(status_updated_at__year=year, status_updated_at__month=month) |
        Q(status_updated_at__isnull=True, created_at__year=year, created_at__month=month)
    )


def _expense_invoice_filter():
    return (
        Q(document_type='factura') |
        Q(document_type__isnull=True) |
        Q(document_type='')
    )


def _expense_exempt_invoice_filter():
    return Q(document_type='factura_exenta')


def _period_cutoff_status(year, month):
    today = timezone.localdate()
    payment_year, payment_month = _next_month(year, month)
    cutoff_without_guide = date(payment_year, payment_month, TAX_CUTOFF_WITHOUT_GUIDE_DAY)
    cutoff_with_guide = date(payment_year, payment_month, TAX_CUTOFF_WITH_GUIDE_DAY)

    if today <= cutoff_without_guide:
        code = 'open'
        label = 'Período abierto para facturas con o sin guía'
    elif today <= cutoff_with_guide:
        code = 'guide_only'
        label = 'Solo facturas respaldadas con guía de despacho'
    else:
        code = 'closed'
        label = 'Período cerrado para facturas emitidas con fecha anterior'

    return {
        'code': code,
        'label': label,
        'cutoff_without_guide': cutoff_without_guide,
        'cutoff_with_guide': cutoff_with_guide,
        'days_to_without_guide': max((cutoff_without_guide - today).days, 0),
        'days_to_with_guide': max((cutoff_with_guide - today).days, 0),
    }


class TaxEstimatorView(APIView):
    """Estimador tributario mensual con soporte de mes/año seleccionable."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.localtime()

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

        # Ventas: proxy operacional basado en cotizaciones aprobadas.
        # Cuando exista módulo/importación de facturas emitidas, esta fuente debe reemplazarse.
        ventas_qs = (
            Quote.objects
            .filter(user=user, status='approved')
            .filter(_quote_period_filter(current_year, current_month))
        )
        ventas_count = ventas_qs.count()
        ventas_netas = ZERO
        iva_debito = ZERO
        ventas_brutas = ZERO
        for quote in ventas_qs:
            net, tax, gross = _quote_amounts(quote)
            ventas_netas += net
            iva_debito += tax
            ventas_brutas += gross

        # Compras de productos: facturas subidas por el usuario.
        # La fecha tributaria estimada es received_date; para datos antiguos se usa created_at.
        facturas_compra_qs = (
            Invoice.objects
            .filter(user=user, status='completed')
            .filter(
                Q(received_date__year=current_year, received_date__month=current_month) |
                Q(received_date__isnull=True, created_at__year=current_year, created_at__month=current_month)
            )
        )
        facturas_compra_count = facturas_compra_qs.count()
        compras_productos_netas = ZERO
        compras_productos_iva = ZERO
        compras_productos_brutas = ZERO
        for invoice in facturas_compra_qs:
            net, tax, gross = _invoice_amounts(invoice)
            compras_productos_netas += net
            compras_productos_iva += tax
            compras_productos_brutas += gross

        # Gastos generales con factura empresa: monto ingresado como bruto, se separa IVA.
        gastos_factura_qs = (
            Expense.objects
            .filter(created_by=user, is_company_invoice=True, date__year=current_year, date__month=current_month)
            .filter(_expense_invoice_filter())
        )
        gastos_factura_count = gastos_factura_qs.count()
        gastos_factura_netas = ZERO
        gastos_factura_iva = ZERO
        gastos_factura_brutas = ZERO
        for expense in gastos_factura_qs:
            net, tax, gross = _split_gross_amount(expense.total_amount or ZERO)
            gastos_factura_netas += net
            gastos_factura_iva += tax
            gastos_factura_brutas += gross

        compras_exentas_qs = (
            Expense.objects
            .filter(created_by=user, is_company_invoice=True, date__year=current_year, date__month=current_month)
            .filter(_expense_exempt_invoice_filter())
        )
        compras_exentas_count = compras_exentas_qs.count()
        compras_exentas_netas = sum((expense.total_amount or ZERO) for expense in compras_exentas_qs)

        compras_giro_netas = compras_productos_netas + gastos_factura_netas
        compras_giro_iva = compras_productos_iva + gastos_factura_iva
        compras_giro_brutas = compras_productos_brutas + gastos_factura_brutas
        compras_giro_count = facturas_compra_count + gastos_factura_count

        remanente_mes_anterior = ZERO
        compras_netas = compras_giro_netas + compras_exentas_netas
        iva_credito = compras_giro_iva + remanente_mes_anterior
        compras_brutas = compras_giro_brutas + compras_exentas_netas
        compras_count = compras_giro_count + compras_exentas_count

        resultado_iva = (iva_debito - iva_credito).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
        impuesto_determinado = max(resultado_iva, ZERO)
        remanente_iva_estimado = max(iva_credito - iva_debito, ZERO)

        ppm_rate = PPM_RATE
        ppm = (ventas_netas * ppm_rate).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

        honorarios_qs = Expense.objects.filter(
            created_by=user,
            document_type='honorario',
            date__year=current_year,
            date__month=current_month,
        )
        honorarios_total = sum((expense.total_amount or ZERO) for expense in honorarios_qs)
        retencion_rate = _honorarios_retention_rate(current_year)
        retencion_2da_categoria = (honorarios_total * retencion_rate).quantize(
            TWO_PLACES, rounding=ROUND_HALF_UP
        )

        active_workers = Worker.objects.filter(user=user, is_active=True)
        impuesto_trabajadores = sum((w.tax_amount or ZERO) for w in active_workers)

        total_impuesto = impuesto_determinado + ppm + retencion_2da_categoria + impuesto_trabajadores
        honorarios_contador = TAX_ESTIMATOR_ACCOUNTANT_FEE
        honorarios_renta_at = _renta_at_fee(current_year, current_month)
        total_a_transferir = total_impuesto + honorarios_contador + honorarios_renta_at

        payment_year, payment_month = _next_month(current_year, current_month)
        mes_pago = f"{MESES[payment_month - 1]} {payment_year}"
        cutoff = _period_cutoff_status(current_year, current_month)
        periodo = f"{MESES[current_month - 1]} {current_year}"

        return Response({
            'periodo': periodo,
            'mes': current_month,
            'anio': current_year,
            'is_current_month': is_current_month,
            'mes_pago': mes_pago,
            'corte_con_guia': f"10 de {MESES[payment_month - 1]} {payment_year}",
            'corte_sin_guia': f"5 de {MESES[payment_month - 1]} {payment_year}",
            'corte_estado': cutoff['code'],
            'corte_estado_label': cutoff['label'],
            'dias_corte_sin_guia': cutoff['days_to_without_guide'],
            'dias_corte_con_guia': cutoff['days_to_with_guide'],

            'ventas_fuente': 'cotizaciones_aprobadas',
            'ventas_es_proyeccion': True,
            'ventas_netas': _money(ventas_netas),
            'ventas_brutas': _money(ventas_brutas),
            'ventas_count': ventas_count,
            'iva_debito': _money(iva_debito),

            'compras_netas': _money(compras_netas),
            'compras_brutas': _money(compras_brutas),
            'compras_count': compras_count,
            'iva_credito': _money(iva_credito),
            'compras_giro_netas': _money(compras_giro_netas),
            'compras_giro_iva': _money(compras_giro_iva),
            'compras_giro_brutas': _money(compras_giro_brutas),
            'compras_giro_count': compras_giro_count,
            'compras_productos_netas': _money(compras_productos_netas),
            'compras_productos_iva': _money(compras_productos_iva),
            'compras_productos_brutas': _money(compras_productos_brutas),
            'facturas_compra_count': facturas_compra_count,
            'gastos_factura_netas': _money(gastos_factura_netas),
            'gastos_factura_iva': _money(gastos_factura_iva),
            'gastos_factura_brutas': _money(gastos_factura_brutas),
            'gastos_factura_count': gastos_factura_count,
            'compras_exentas_netas': _money(compras_exentas_netas),
            'compras_exentas_count': compras_exentas_count,
            'remanente_mes_anterior': _money(remanente_mes_anterior),

            'resultado_iva': _money(resultado_iva),
            'impuesto_determinado': _money(impuesto_determinado),
            'remanente_iva_estimado': _money(remanente_iva_estimado),
            'ppm_rate': str(ppm_rate),
            'ppm': _money(ppm),
            'honorarios_total': _money(honorarios_total),
            'retencion_honorarios_rate': str(retencion_rate),
            'retencion_2da_categoria': _money(retencion_2da_categoria),
            'impuesto_trabajadores': _money(impuesto_trabajadores),
            'total_impuesto': _money(total_impuesto),
            'honorarios_contador': _money(honorarios_contador),
            'honorarios_renta_at': _money(honorarios_renta_at),
            'honorarios_renta_at_label': f"HON RENTA AT {current_year}" if honorarios_renta_at else '',
            'total_a_transferir': _money(total_a_transferir),
        })


class AvailableMonthsView(APIView):
    """Retorna meses que tienen datos tributarios estimables."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.localtime()

        months_set = set()

        quote_months = (
            Quote.objects
            .filter(user=user, status='approved', status_updated_at__isnull=False)
            .annotate(month=TruncMonth('status_updated_at'))
            .values_list('month', flat=True)
            .distinct()
        )
        fallback_quote_months = (
            Quote.objects
            .filter(user=user, status='approved', status_updated_at__isnull=True)
            .annotate(month=TruncMonth('created_at'))
            .values_list('month', flat=True)
            .distinct()
        )
        for month in list(quote_months) + list(fallback_quote_months):
            if month:
                months_set.add((month.year, month.month))

        for invoice in Invoice.objects.filter(user=user, status='completed').only('received_date', 'created_at'):
            receipt_date = invoice.received_date or _local_date(invoice.created_at)
            if receipt_date:
                months_set.add((receipt_date.year, receipt_date.month))

        expense_months = (
            Expense.objects
            .filter(created_by=user)
            .filter(Q(is_company_invoice=True) | Q(document_type='honorario') | Q(document_type='factura_exenta'))
            .annotate(month=TruncMonth('date'))
            .values_list('month', flat=True)
            .distinct()
        )
        for month in expense_months:
            if month:
                months_set.add((month.year, month.month))

        months_set.add((now.year, now.month))
        current = (now.year, now.month)
        months_set = {month for month in months_set if month <= current}

        result = sorted(months_set, reverse=True)
        return Response([{'year': year, 'month': month} for year, month in result])
