from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers as drf_serializers
from django.db.models import OuterRef, Subquery, Max
import logging

from .models import CompanyProfile, Quote
from .serializers import (
    CompanyProfileSerializer, QuoteListSerializer,
    QuoteDetailSerializer, QuoteCreateSerializer,
)
from products.models import Product, PriceHistory
from invoices.models import InvoiceItem

logger = logging.getLogger(__name__)


class CompanyProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            profile = CompanyProfile.objects.get(user=request.user)
            serializer = CompanyProfileSerializer(profile)
            return Response(serializer.data)
        except CompanyProfile.DoesNotExist:
            return Response({'detail': 'Perfil de empresa no encontrado'}, status=status.HTTP_404_NOT_FOUND)

    def put(self, request):
        profile, _ = CompanyProfile.objects.get_or_create(user=request.user)
        serializer = CompanyProfileSerializer(profile, data=request.data, partial=False)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        profile, _ = CompanyProfile.objects.get_or_create(user=request.user)
        serializer = CompanyProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProductCatalogSerializer(drf_serializers.ModelSerializer):
    last_price = drf_serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, allow_null=True)

    class Meta:
        model = Product
        fields = ['id', 'name', 'unit', 'stock', 'last_price']


class ProductCatalogView(ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProductCatalogSerializer

    def get_queryset(self):
        last_price_sq = PriceHistory.objects.filter(
            product=OuterRef('pk')
        ).order_by('-recorded_at').values('price')[:1]

        qs = Product.objects.filter(is_active=True).annotate(
            last_price=Subquery(last_price_sq)
        )
        search = self.request.query_params.get('search', '')
        if search:
            qs = qs.filter(name__icontains=search)
        return qs.order_by('name')


class ProductByProviderSearchView(APIView):
    """
    Busca productos en InvoiceItem agrupados por proveedor.
    Retorna todos los proveedores que tienen ese producto,
    con su precio más reciente y stock de ProviderInventory.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        search = request.query_params.get('search', '').strip()
        if len(search) < 2:
            return Response([])

        # Buscar en InvoiceItem por descripción, agrupado por (descripción, proveedor)
        # Obtener el item más reciente por cada combinación (descripción, proveedor)
        from django.db.models import Max
        from products.models import Provider

        # Subquery para obtener el id del item más reciente por (description, provider)
        latest_ids = (
            InvoiceItem.objects
            .filter(
                description__icontains=search,
                invoice__status='completed',
                unit_price__isnull=False,
            )
            .values('description', 'invoice__provider_id')
            .annotate(latest_id=Max('id'))
            .values_list('latest_id', flat=True)
        )

        items = (
            InvoiceItem.objects
            .filter(id__in=latest_ids)
            .select_related('invoice__provider', 'product')
            .order_by('description', 'invoice__provider__name')
        )

        results = []
        for item in items:
            provider = item.invoice.provider if item.invoice else None
            if not provider:
                continue

            # Buscar stock en ProviderInventory si existe
            stock = None
            provider_inventory_id = None
            try:
                from provider_inventory.models import ProviderInventory
                inv = ProviderInventory.objects.filter(
                    product_name__iexact=item.description,
                    provider=provider,
                ).first()
                if inv:
                    stock = float(inv.stock_quantity)
                    provider_inventory_id = inv.id
            except Exception:
                pass

            # Calcular precio de venta con markup
            unit_price = float(item.unit_price) if item.unit_price else 0
            markup = float(item.markup_percentage) if item.markup_percentage else 0
            sell_price = round(unit_price * (1 + markup / 100), 0)

            results.append({
                'id': item.product.id if item.product else None,
                'invoice_item_id': item.id,
                'provider_inventory_id': provider_inventory_id,
                'name': item.description,
                'provider_id': provider.id,
                'provider_name': provider.name,
                'unit': item.unit_measure or 'unidad',
                'unit_price': unit_price,
                'sell_price': sell_price,
                'markup_percentage': markup,
                'stock': stock,
            })

        return Response(results)


class QuoteViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Quote.objects.filter(user=self.request.user)
        status_filter = self.request.query_params.get('status', '')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return QuoteListSerializer
        if self.action == 'retrieve':
            return QuoteDetailSerializer
        return QuoteCreateSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def update(self, request, *args, **kwargs):
        quote = self.get_object()
        if quote.status != 'draft':
            return Response(
                {'error': 'Solo se pueden editar cotizaciones en estado borrador'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='cambiar-estado')
    def cambiar_estado(self, request, pk=None):
        quote = self.get_object()
        new_status = request.data.get('status')
        allowed = Quote.ALLOWED_TRANSITIONS.get(quote.status, [])
        if new_status not in allowed:
            return Response(
                {'error': 'Transición de estado no permitida'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        quote.status = new_status
        quote.status_updated_at = timezone.now()
        quote.save(update_fields=['status', 'status_updated_at'])

        # Al aprobar: descontar stock de ProviderInventory
        if new_status == 'approved':
            self._descontar_stock(quote, request.user)

        # Al rechazar o cancelar: restaurar stock
        if new_status == 'rejected':
            self._restaurar_stock(quote, request.user)

        return Response({'status': quote.status, 'quote_number': quote.quote_number})

    def _descontar_stock(self, quote, user):
        """Descuenta stock de ProviderInventory al aprobar una cotización."""
        try:
            from provider_inventory.models import ProviderInventory, ProviderInventoryAuditLog
            from django.db import transaction

            for item in quote.items.all():
                # Buscar por nombre + proveedor si está disponible, si no solo por nombre
                qs = ProviderInventory.objects.filter(product_name__iexact=item.product_name)
                if item.provider_id:
                    qs = qs.filter(provider_id=item.provider_id)
                inv = qs.first()

                if not inv:
                    continue

                with transaction.atomic():
                    inv_locked = ProviderInventory.objects.select_for_update().get(id=inv.id)
                    if inv_locked.stock_quantity >= item.quantity:
                        qty_before = inv_locked.stock_quantity
                        inv_locked.stock_quantity -= item.quantity
                        inv_locked.save()

                        ProviderInventoryAuditLog.objects.create(
                            inventory=inv_locked,
                            action='decrement',
                            quantity_before=qty_before,
                            quantity_after=inv_locked.stock_quantity,
                            quantity_changed=-item.quantity,
                            source='quote',
                            quote_id=quote.id,
                            quote_item_id=item.id,
                            user=user,
                        )
        except Exception as e:
            logger.error(f'Error descontando stock para cotización {quote.quote_number}: {e}')

    def _restaurar_stock(self, quote, user):
        """Restaura stock de ProviderInventory al rechazar una cotización."""
        try:
            from provider_inventory.models import ProviderInventory, ProviderInventoryAuditLog
            from django.db import transaction

            for item in quote.items.all():
                qs = ProviderInventory.objects.filter(product_name__iexact=item.product_name)
                if item.provider_id:
                    qs = qs.filter(provider_id=item.provider_id)
                inv = qs.first()

                if not inv:
                    continue

                with transaction.atomic():
                    inv_locked = ProviderInventory.objects.select_for_update().get(id=inv.id)
                    qty_before = inv_locked.stock_quantity
                    inv_locked.stock_quantity += item.quantity
                    inv_locked.save()

                    ProviderInventoryAuditLog.objects.create(
                        inventory=inv_locked,
                        action='restore',
                        quantity_before=qty_before,
                        quantity_after=inv_locked.stock_quantity,
                        quantity_changed=item.quantity,
                        source='quote',
                        quote_id=quote.id,
                        quote_item_id=item.id,
                        user=user,
                    )
        except Exception as e:
            logger.error(f'Error restaurando stock para cotización {quote.quote_number}: {e}')

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        quote = self.get_object()
        try:
            company_profile = CompanyProfile.objects.get(user=request.user)
        except CompanyProfile.DoesNotExist:
            return Response(
                {'error': 'Complete el perfil de empresa antes de generar el PDF'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not company_profile.is_complete:
            return Response(
                {'error': 'Complete el perfil de empresa antes de generar el PDF'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            from .pdf_generator import generate_quote_pdf
            pdf_bytes = generate_quote_pdf(quote, company_profile)
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{quote.quote_number}.pdf"'
            return response
        except Exception as e:
            logger.error(f'Error generando PDF para cotización {quote.quote_number}: {e}')
            return Response(
                {'error': 'Error al generar el PDF. Intente nuevamente.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
