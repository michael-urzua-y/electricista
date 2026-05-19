"""
Vistas para el módulo de precios.
"""
from django.db.models import Count
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import PriceItem, PriceSubItem
from .serializers import (
    PriceItemSerializer,
    PriceItemListSerializer,
    PriceSubItemSerializer,
    PriceSubItemSearchSerializer,
)


class PriceItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de Ítems de precio.

    list:    GET    /api/prices/items/
    create:  POST   /api/prices/items/
    retrieve: GET   /api/prices/items/{id}/
    update:  PUT    /api/prices/items/{id}/
    destroy: DELETE /api/prices/items/{id}/
    subitems: GET/POST /api/prices/items/{id}/subitems/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            PriceItem.objects
            .filter(user=self.request.user)
            .annotate(subitems_count=Count('subitems'))
            .order_by('order_number')
        )

    def get_serializer_class(self):
        if self.action == 'list':
            return PriceItemListSerializer
        return PriceItemSerializer

    def perform_create(self, serializer):
        # Asignar el siguiente número de orden disponible
        last_order = (
            PriceItem.objects
            .filter(user=self.request.user)
            .order_by('-order_number')
            .values_list('order_number', flat=True)
            .first()
        ) or 0
        serializer.save(user=self.request.user, order_number=last_order + 1)

    def perform_destroy(self, instance):
        # Elimina el ítem y sus sub-ítems (CASCADE)
        instance.delete()

    # ------------------------------------------------------------------
    # Action: subitems — listar y crear sub-ítems de un ítem
    # ------------------------------------------------------------------
    @action(detail=True, methods=['get', 'post'], url_path='subitems')
    def subitems(self, request, pk=None):
        item = self.get_object()

        if request.method == 'GET':
            subitems = item.subitems.all().order_by('sub_number')
            serializer = PriceSubItemSerializer(subitems, many=True)
            return Response(serializer.data)

        # POST — crear sub-ítem
        serializer = PriceSubItemSerializer(data=request.data)
        if serializer.is_valid():
            # Asignar siguiente número secuencial
            last_sub = (
                item.subitems
                .order_by('-sub_number')
                .values_list('sub_number', flat=True)
                .first()
            ) or 0
            serializer.save(item=item, sub_number=last_sub + 1)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PriceSubItemViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión directa de Sub-Ítems (update, delete).

    list:    GET    /api/prices/subitems/       — todos los sub-ítems del usuario
    retrieve: GET  /api/prices/subitems/{id}/
    update:  PUT   /api/prices/subitems/{id}/
    destroy: DELETE /api/prices/subitems/{id}/

    Búsqueda: GET /api/prices/subitems/?search=<texto>
    - Si search tiene < 2 caracteres, retorna lista vacía
    - Filtra por description__icontains y limita a 20 resultados
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        search = self.request.query_params.get('search', '').strip()
        if search:
            return PriceSubItemSearchSerializer
        return PriceSubItemSerializer

    def get_queryset(self):
        search = self.request.query_params.get('search', '').strip()
        if search:
            if len(search) < 2:
                return PriceSubItem.objects.none()
            return (
                PriceSubItem.objects
                .filter(item__user=self.request.user, description__icontains=search)
                .select_related('item')
            )[:20]
        return (
            PriceSubItem.objects
            .filter(item__user=self.request.user)
            .select_related('item')
            .order_by('item__order_number', 'sub_number')
        )

    @property
    def paginator(self):
        """Disable pagination when search param is present."""
        search = self.request.query_params.get('search', '').strip()
        if search:
            return None
        return super().paginator

    def perform_update(self, serializer):
        serializer.save()
