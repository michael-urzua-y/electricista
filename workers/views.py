from decimal import Decimal

import requests
from django.core.cache import cache
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Worker
from .serializers import WorkerSerializer


class WorkerViewSet(viewsets.ModelViewSet):
    """API para gestionar trabajadores."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WorkerSerializer

    def get_queryset(self):
        """Filtrar trabajadores por usuario autenticado."""
        return Worker.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Asignar usuario al crear trabajador."""
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'], url_path='valor-uf')
    def valor_uf(self, request):
        """Obtener el valor UF diario para calcular planes de Isapre."""
        today = timezone.localdate()
        cache_key = f'workers:uf:{today.isoformat()}'
        cached = cache.get(cache_key)
        if cached:
            return Response({**cached, 'cached': True})

        try:
            response = requests.get('https://mindicador.cl/api', timeout=5)
            response.raise_for_status()
            data = response.json()
            uf_data = data.get('uf') or {}
            raw_value = uf_data.get('valor')
            if raw_value is None:
                raise ValueError('La respuesta no contiene valor UF')

            value = Decimal(str(raw_value)).quantize(Decimal('0.01'))
            payload = {
                'value': str(value),
                'date': uf_data.get('fecha') or data.get('fecha') or today.isoformat(),
                'source': 'mindicador.cl',
            }
            cache.set(cache_key, payload, 60 * 60 * 12)
            cache.set('workers:uf:last_success', payload, 60 * 60 * 24 * 30)
            return Response({**payload, 'cached': False})
        except Exception:
            fallback = cache.get('workers:uf:last_success')
            if fallback:
                return Response({
                    **fallback,
                    'cached': True,
                    'stale': True,
                    'warning': 'No se pudo actualizar la UF; se usó el último valor disponible.',
                })

            return Response(
                {'detail': 'No se pudo obtener el valor UF diario.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
