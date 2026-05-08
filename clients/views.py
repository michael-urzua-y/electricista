"""
Vistas para el módulo de clientes.
"""
from django.db.models import Max, Sum, Count, Q
from django.utils import timezone
from datetime import timedelta

from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Client, ClientSettings
from .serializers import ClientSerializer, ClientListSerializer, ClientSettingsSerializer


class ClientViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de clientes.

    list:   GET  /api/clients/          — listado con búsqueda ?q=
    create: POST /api/clients/          — crear cliente
    retrieve: GET /api/clients/{id}/    — detalle
    update: PUT  /api/clients/{id}/     — editar (rut inmutable)
    partial_update: PATCH /api/clients/{id}/ — editar parcial (rut inmutable)
    destroy: DELETE /api/clients/{id}/  — desactiva (no elimina)
    quotes: GET /api/clients/{id}/quotes/  — historial de cotizaciones
    stats:  GET /api/clients/{id}/stats/   — estadísticas del cliente
    inactive: GET /api/clients/inactive/   — clientes inactivos
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Max, Sum
        from quotes.models import Quote

        qs = Client.objects.filter(user=self.request.user)

        # Anotar last_quote_date y total_approved para el listado
        qs = qs.annotate(
            last_quote_date=Max(
                'quotes__created_at',
                filter=Q(quotes__user=self.request.user),
            ),
            total_approved=Sum(
                'quotes__total_amount',
                filter=Q(
                    quotes__user=self.request.user,
                    quotes__status='approved',
                ),
            ),
        )
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return ClientListSerializer
        return ClientSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    # ------------------------------------------------------------------
    # list — soporta ?q= para búsqueda por nombre, RUT o email (mín 2 chars)
    # ------------------------------------------------------------------
    def list(self, request, *args, **kwargs):
        q = request.query_params.get('q', '').strip()
        qs = self.get_queryset()

        if q:
            if len(q) < 2:
                return Response(
                    {'detail': 'El término de búsqueda debe tener al menos 2 caracteres.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            qs = qs.filter(
                Q(name__icontains=q) |
                Q(rut__icontains=q) |
                Q(email__icontains=q)
            )

        serializer = ClientListSerializer(qs, many=True)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    # destroy — desactiva en lugar de eliminar; error si tiene cotizaciones activas
    # ------------------------------------------------------------------
    def destroy(self, request, *args, **kwargs):
        client = self.get_object()

        # Verificar cotizaciones activas (status != rejected)
        active_quotes = client.quotes.exclude(status='rejected').count()
        if active_quotes > 0:
            return Response(
                {
                    'detail': (
                        f'El cliente tiene {active_quotes} cotización(es) activa(s) '
                        'y no puede ser eliminado. Desactívelo en su lugar.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        client.is_active = False
        client.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # update / partial_update — impide modificar el campo rut
    # ------------------------------------------------------------------
    def update(self, request, *args, **kwargs):
        if 'rut' in request.data:
            data = request.data.copy()
            data.pop('rut')
            request._full_data = data
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    # ------------------------------------------------------------------
    # Action: quotes — historial de cotizaciones del cliente
    # ------------------------------------------------------------------
    @action(detail=True, methods=['get'])
    def quotes(self, request, pk=None):
        from quotes.serializers import QuoteListSerializer

        client = self.get_object()
        client_quotes = client.quotes.filter(user=request.user).order_by('-created_at')

        # Filtro opcional por estado
        status_filter = request.query_params.get('status', '')
        if status_filter:
            client_quotes = client_quotes.filter(status=status_filter)

        serializer = QuoteListSerializer(client_quotes, many=True)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    # Action: stats — total comprado y top 5 productos
    # ------------------------------------------------------------------
    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        from quotes.models import QuoteItem
        from django.db.models import Sum, Count

        client = self.get_object()

        # Total aprobado
        total_approved = (
            client.quotes
            .filter(user=request.user, status='approved')
            .aggregate(total=Sum('total_amount'))['total']
        ) or 0

        # Top 5 productos por frecuencia en QuoteItem (cualquier estado)
        top_products = (
            QuoteItem.objects
            .filter(quote__user=request.user, quote__client=client)
            .values('product_name')
            .annotate(count=Count('id'))
            .order_by('-count')[:5]
        )

        return Response({
            'total_approved': total_approved,
            'top_products': [
                {'name': item['product_name'], 'count': item['count']}
                for item in top_products
            ],
        })

    # ------------------------------------------------------------------
    # Action: inactive — clientes inactivos según ClientSettings.inactivity_days
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'])
    def inactive(self, request):
        from django.db.models import Max, ExpressionWrapper, F, DurationField
        from django.db.models.functions import Now

        # Obtener días de inactividad configurados (default 90)
        try:
            settings_obj = ClientSettings.objects.get(user=request.user)
            inactivity_days = settings_obj.inactivity_days
        except ClientSettings.DoesNotExist:
            inactivity_days = 90

        cutoff_date = timezone.now() - timedelta(days=inactivity_days)

        qs = (
            Client.objects
            .filter(user=request.user, is_active=True)
            .annotate(
                last_quote_date=Max(
                    'quotes__created_at',
                    filter=Q(quotes__user=request.user),
                ),
            )
            .filter(
                Q(last_quote_date__lt=cutoff_date) |
                Q(last_quote_date__isnull=True)
            )
        )

        # Calcular días de inactividad para cada cliente
        now = timezone.now()
        result = []
        for client in qs.order_by('last_quote_date'):
            if client.last_quote_date:
                days_inactive = (now - client.last_quote_date).days
            else:
                # Sin cotizaciones: usar fecha de creación como referencia
                days_inactive = (now - client.created_at).days

            result.append({
                'id': client.id,
                'rut': client.rut,
                'name': client.name,
                'email': client.email,
                'phone': client.phone,
                'is_active': client.is_active,
                'last_quote_date': client.last_quote_date,
                'days_inactive': days_inactive,
            })

        # Ordenar de mayor a menor inactividad
        result.sort(key=lambda x: x['days_inactive'], reverse=True)
        return Response(result)


class ClientSettingsView(APIView):
    """
    GET  /api/clients/settings/ — obtener configuración (o defaults)
    PATCH /api/clients/settings/ — actualizar configuración
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        settings_obj, _ = ClientSettings.objects.get_or_create(
            user=request.user,
            defaults={'inactivity_days': 90},
        )
        serializer = ClientSettingsSerializer(settings_obj)
        return Response(serializer.data)

    def patch(self, request):
        settings_obj, _ = ClientSettings.objects.get_or_create(
            user=request.user,
            defaults={'inactivity_days': 90},
        )
        serializer = ClientSettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
