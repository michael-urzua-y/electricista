from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import logging

from .models import CompanyProfile, SMTPConfig, Quote, QuoteEmailLog
from .serializers import (
    CompanyProfileSerializer, SMTPConfigSerializer, QuoteListSerializer,
    QuoteDetailSerializer, QuoteCreateSerializer,
)

logger = logging.getLogger(__name__)


class CompanyProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

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


class SMTPConfigView(APIView):
    """CRUD de la configuración SMTP del usuario."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            config = SMTPConfig.objects.get(user=request.user)
            serializer = SMTPConfigSerializer(config)
            return Response(serializer.data)
        except SMTPConfig.DoesNotExist:
            return Response({'detail': 'Configuración SMTP no encontrada'}, status=status.HTTP_404_NOT_FOUND)

    def post(self, request):
        serializer = SMTPConfigSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            config = serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request):
        config, _ = SMTPConfig.objects.get_or_create(user=request.user)
        serializer = SMTPConfigSerializer(config, data=request.data, partial=False, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        config, _ = SMTPConfig.objects.get_or_create(user=request.user)
        serializer = SMTPConfigSerializer(config, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request):
        try:
            config = SMTPConfig.objects.get(user=request.user)
            config.delete()
            return Response({'detail': 'Configuración SMTP eliminada'}, status=status.HTTP_204_NO_CONTENT)
        except SMTPConfig.DoesNotExist:
            return Response({'detail': 'Configuración SMTP no encontrada'}, status=status.HTTP_404_NOT_FOUND)


class SMTPTestView(APIView):
    """Prueba de conexión SMTP sin guardar."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        import smtplib

        data = request.data
        host = data.get('smtp_host')
        port = int(data.get('smtp_port', 587))
        user = data.get('smtp_user')
        password = data.get('smtp_password', '')
        use_tls = data.get('use_tls', True)
        use_ssl = data.get('use_ssl', False)

        if not host or not user:
            return Response(
                {'detail': 'Faltan datos de conexión: host y usuario son requeridos'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        server = None
        try:
            if use_ssl:
                server = smtplib.SMTP_SSL(host, port, timeout=15)
            else:
                server = smtplib.SMTP(host, port, timeout=15)
                if use_tls:
                    server.starttls()

            if password:
                server.login(user, password)

            server.quit()
            return Response({'detail': 'Conexión exitosa', 'status': 'ok'})

        except smtplib.SMTPAuthenticationError:
            if server:
                try:
                    server.quit()
                except Exception:
                    pass
            return Response(
                {'detail': 'Error de autenticación. Revisa tu correo y contraseña de aplicación.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except smtplib.SMTPConnectError:
            return Response(
                {'detail': f'No se pudo conectar a {host}:{port}. Revisa el servidor y puerto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

class CompanyLogoView(APIView):
    """Sirve el logo de la empresa desde binario en BD."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            profile = CompanyProfile.objects.get(user=request.user)
        except CompanyProfile.DoesNotExist:
            return Response({'error': 'Perfil no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        if not profile.logo_data:
            # Fallback: si aún está en logo_base64, decodificar y servir
            if profile.logo_base64:
                import base64
                try:
                    data = base64.b64decode(profile.logo_base64)
                    mime = 'image/png' if data[:4] == b'\x89PNG' else 'image/jpeg'
                    return HttpResponse(data, content_type=mime)
                except Exception:
                    pass
            return Response({'error': 'No hay logo'}, status=status.HTTP_404_NOT_FOUND)

        mime = profile.logo_mime or 'image/png'
        return HttpResponse(bytes(profile.logo_data), content_type=mime)

    def delete(self, request):
        try:
            profile = CompanyProfile.objects.get(user=request.user)
            profile.logo_data = None
            profile.logo_mime = ''
            profile.logo_size = None
            profile.logo_base64 = ''
            profile.save()
            return Response({'message': 'Logo eliminado'})
        except CompanyProfile.DoesNotExist:
            return Response({'error': 'Perfil no encontrado'}, status=status.HTTP_404_NOT_FOUND)


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

    @action(detail=True, methods=['post'], url_path='send-email')
    def send_email(self, request, pk=None):
        quote = self.get_object()

        try:
            company_profile = CompanyProfile.objects.get(user=request.user)
        except CompanyProfile.DoesNotExist:
            return Response(
                {'error': 'Complete el perfil de empresa antes de enviar el email'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        smtp_config = None
        try:
            smtp_config = SMTPConfig.objects.get(user=request.user, is_active=True)
        except SMTPConfig.DoesNotExist:
            pass

        from .email_service import send_quote_email
        log = send_quote_email(quote, company_profile, request.user, smtp_config=smtp_config)

        if log.status == 'failed':
            return Response(
                {'error': log.error_message},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                'sent_at': log.sent_at,
                'recipient': log.recipient,
                'status': log.status,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['get'], url_path='email-logs')
    def email_logs(self, request, pk=None):
        quote = self.get_object()
        logs = QuoteEmailLog.objects.filter(quote=quote).order_by('-sent_at')
        data = [
            {
                'id': log.id,
                'sent_at': log.sent_at,
                'recipient': log.recipient,
                'status': log.status,
                'error_message': log.error_message,
            }
            for log in logs
        ]
        return Response(data, status=status.HTTP_200_OK)
