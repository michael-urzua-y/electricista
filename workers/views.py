from rest_framework import viewsets, permissions
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
