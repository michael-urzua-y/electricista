from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers as drf_serializers
from django.db.models import OuterRef, Subquery
import logging

from .models import CompanyProfile, Quote
from .serializers import (
    CompanyProfileSerializer, QuoteListSerializer,
    QuoteDetailSerializer, QuoteCreateSerializer,
)
from .pdf_generator import generate_quote_pdf
from products.models import Product, PriceHistory

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
        return Response({'status': quote.status, 'quote_number': quote.quote_number})

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
