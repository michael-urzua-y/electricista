from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.http import HttpResponse
from .models import Expense
from .serializers import ExpenseListSerializer, ExpenseCreateUpdateSerializer
from monaysolutions.module_access import HasModuleAccess


class ExpenseViewSet(viewsets.ModelViewSet):
    """API para gestionar gastos generales."""

    permission_classes = [permissions.IsAuthenticated, HasModuleAccess]
    parser_classes = [MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ExpenseCreateUpdateSerializer
        return ExpenseListSerializer

    def get_queryset(self):
        """Aislar gastos por usuario dentro de la app."""
        return Expense.objects.select_related('created_by').filter(created_by=self.request.user)

    def perform_create(self, serializer):
        """Crear gasto con archivo binario en BD."""
        uploaded_file = self.request.FILES.get('file')
        file_kwargs = {}

        if uploaded_file:
            file_content = uploaded_file.read()
            file_name = uploaded_file.name
            file_ext = (
                file_name.rsplit('.', 1)[-1].lower()
                if file_name and '.' in file_name
                else None
            )
            file_kwargs = {
                'file_data': file_content,
                'file_name': file_name,
                'file_type': file_ext,
                'file_size': len(file_content),
            }

        serializer.validated_data.pop('file', None)
        serializer.save(created_by=self.request.user, **file_kwargs)

    def perform_update(self, serializer):
        """Actualizar gasto, reemplazando archivo si se envía uno nuevo."""
        uploaded_file = self.request.FILES.get('file')
        file_kwargs = {}

        if uploaded_file:
            file_content = uploaded_file.read()
            file_name = uploaded_file.name
            file_ext = (
                file_name.rsplit('.', 1)[-1].lower()
                if file_name and '.' in file_name
                else None
            )
            file_kwargs = {
                'file_data': file_content,
                'file_name': file_name,
                'file_type': file_ext,
                'file_size': len(file_content),
            }

        serializer.validated_data.pop('file', None)
        serializer.save(**file_kwargs)

    @action(detail=True, methods=['get'], url_path='comprobante')
    def comprobante(self, request, pk=None):
        """Servir el archivo comprobante almacenado en BD."""
        expense = self.get_object()

        if not expense.file_data:
            return Response(
                {'error': 'No hay comprobante disponible para este gasto'},
                status=status.HTTP_404_NOT_FOUND,
            )

        file_type = (expense.file_type or '').lower()
        content_type_map = {
            'pdf': 'application/pdf',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
        }
        content_type = content_type_map.get(file_type, 'application/octet-stream')
        file_name = expense.file_name or f'comprobante_{expense.id}.{file_type}'

        response = HttpResponse(bytes(expense.file_data), content_type=content_type)
        response['Content-Disposition'] = f'inline; filename="{file_name}"'
        return response
