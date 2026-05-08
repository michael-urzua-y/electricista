"""
Servicio de KPIs para el dashboard del negocio.
"""
import logging
from datetime import date
from typing import Optional

from django.db.models import (
    Count, Sum, F, Q, DecimalField,
    ExpressionWrapper, Subquery, OuterRef,
)
from django.db.models.functions import ExtractYear, ExtractMonth
from django.utils import timezone

from quotes.models import Quote, QuoteItem
from clients.models import Client, ClientSettings
from provider_inventory.models import ProviderInventory
from provider_inventory.services import get_low_stock_items

logger = logging.getLogger(__name__)


def _prev_month(year: int, month: int):
    if month == 1:
        return year - 1, 12
    return year, month - 1


def _get_conversion_rate(user, year: int, month: int) -> float:
    qs = Quote.objects.filter(
        user=user,
        created_at__year=year,
        created_at__month=month,
        status__in=['sent', 'approved', 'rejected'],
    ).aggregate(
        total=Count('id'),
        approved=Count('id', filter=Q(status='approved')),
    )
    total = qs['total'] or 0
    approved = qs['approved'] or 0
    if total == 0:
        return 0.0
    return round((approved / total) * 100, 2)


def _get_avg_margin(user, year: int, month: int) -> Optional[float]:
    inv_unit_price_sq = (
        ProviderInventory.objects
        .filter(id=OuterRef('provider_inventory_id'))
        .values('unit_price')[:1]
    )
    items_with_cost = (
        QuoteItem.objects
        .filter(
            quote__user=user,
            quote__status='approved',
            quote__created_at__year=year,
            quote__created_at__month=month,
            provider_inventory_id__isnull=False,
        )
        .annotate(inv_unit_price=Subquery(inv_unit_price_sq, output_field=DecimalField()))
        .filter(inv_unit_price__isnull=False)
        .values('quote_id')
        .annotate(
            revenue=Sum('line_total'),
            cost=Sum(ExpressionWrapper(
                F('quantity') * F('inv_unit_price'),
                output_field=DecimalField(max_digits=16, decimal_places=2),
            )),
        )
        .filter(revenue__gt=0)
    )
    margins = []
    for row in items_with_cost:
        revenue = row['revenue']
        cost = row['cost']
        if revenue and revenue > 0:
            margins.append(float((revenue - cost) / revenue * 100))
    if not margins:
        return None
    return round(sum(margins) / len(margins), 2)


def _get_top_products(user, year: int, month: int) -> list[dict]:
    """
    Top 5 productos por cantidad total acumulada en ítems de cotizaciones del mes.
    Suma las cantidades de todos los ítems con el mismo nombre de producto.
    """
    qs = (
        QuoteItem.objects
        .filter(
            quote__user=user,
            quote__created_at__year=year,
            quote__created_at__month=month,
        )
        .values('product_name')
        .annotate(count=Sum('quantity'))
        .order_by('-count')[:5]
    )
    return [{'name': row['product_name'], 'count': float(row['count'])} for row in qs]


def _get_top_clients(user, year: int, month: int) -> list[dict]:
    qs = (
        Quote.objects
        .filter(user=user, status='approved', created_at__year=year, created_at__month=month)
        .values('client_name')
        .annotate(total=Sum('total_amount'))
        .order_by('-total')[:5]
    )
    return [{'name': row['client_name'] or 'Sin nombre', 'total': float(row['total'] or 0)} for row in qs]


def _get_sales_comparison(user, year: int, month: int) -> dict:
    prev_year, prev_month = _prev_month(year, month)

    def _month_total(y, m):
        result = Quote.objects.filter(
            user=user, status='approved',
            created_at__year=y, created_at__month=m,
        ).aggregate(total=Sum('total_amount'))
        return float(result['total'] or 0)

    current = _month_total(year, month)
    prev = _month_total(prev_year, prev_month)
    variation_abs = current - prev
    variation_pct = round((variation_abs / prev) * 100, 2) if prev != 0 else None
    return {
        'current_month_total': current,
        'prev_month_total': prev,
        'variation_pct': variation_pct,
        'variation_abs': variation_abs,
    }


def _get_monthly_chart(user, year: int, month: int) -> list[dict]:
    months = []
    y, m = year, month
    for _ in range(12):
        months.append((y, m))
        y, m = _prev_month(y, m)
    months.reverse()
    start_year, start_month = months[0]
    qs = (
        Quote.objects
        .filter(user=user, status='approved', created_at__year__gte=start_year)
        .filter(
            Q(created_at__year__gt=start_year) |
            Q(created_at__year=start_year, created_at__month__gte=start_month)
        )
        .filter(
            Q(created_at__year__lt=year) |
            Q(created_at__year=year, created_at__month__lte=month)
        )
        .annotate(q_year=ExtractYear('created_at'), q_month=ExtractMonth('created_at'))
        .values('q_year', 'q_month')
        .annotate(total=Sum('total_amount'))
    )
    totals_map = {(row['q_year'], row['q_month']): float(row['total'] or 0) for row in qs}
    return [{'month': m, 'year': y, 'total': totals_map.get((y, m), 0.0)} for y, m in months]


def _get_inactive_clients_count(user) -> int:
    """
    Clientes activos cuya última cotización fue hace más días que inactivity_days.
    Clientes sin ninguna cotización NO se consideran inactivos.
    """
    try:
        settings_obj = ClientSettings.objects.get(user=user)
        inactivity_days = settings_obj.inactivity_days
    except ClientSettings.DoesNotExist:
        inactivity_days = 90

    from datetime import timedelta
    cutoff = timezone.now() - timedelta(days=inactivity_days)

    last_quote_sq = (
        Quote.objects
        .filter(client=OuterRef('pk'), user=user)
        .order_by('-created_at')
        .values('created_at')[:1]
    )

    return (
        Client.objects
        .filter(user=user, is_active=True)
        .annotate(last_quote_date=Subquery(last_quote_sq))
        .filter(last_quote_date__lt=cutoff)  # NULL excluido → sin cotizaciones no cuenta
        .count()
    )


def _get_low_stock_count() -> int:
    return get_low_stock_items().count()


def get_dashboard_kpis(user, year: int = None, month: int = None) -> dict:
    today = date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month

    return {
        'year': year,
        'month': month,
        'conversion_rate': _get_conversion_rate(user, year, month),
        'avg_margin': _get_avg_margin(user, year, month),
        'top_products': _get_top_products(user, year, month),
        'top_clients': _get_top_clients(user, year, month),
        'sales_comparison': _get_sales_comparison(user, year, month),
        'monthly_chart': _get_monthly_chart(user, year, month),
        'inactive_clients_count': _get_inactive_clients_count(user),
        'low_stock_count': _get_low_stock_count(),
    }
