"""
Servicio de envío de cotizaciones por email.
"""
import logging

from django.core.mail import EmailMessage
from django.utils import timezone

from quotes.models import Quote, QuoteEmailLog

logger = logging.getLogger(__name__)


def send_quote_email(quote: Quote, company_profile, user) -> QuoteEmailLog:
    """
    Envía la cotización en PDF al email del cliente.

    Flujo:
    1. Valida que quote.client_email no esté vacío.
    2. Valida que company_profile.is_complete.
    3. Genera el PDF con generate_quote_pdf().
    4. Envía el email con el PDF adjunto.
    5. Si es exitoso y la cotización está en 'draft', cambia el estado a 'sent'.
    6. Registra y retorna un QuoteEmailLog con el resultado.

    :param quote: Instancia de Quote a enviar.
    :param company_profile: Instancia de CompanyProfile del usuario.
    :param user: Usuario autenticado (para logging).
    :returns: QuoteEmailLog con el resultado del intento.
    """
    recipient = quote.client_email

    # Validación 1: email del cliente requerido
    if not recipient:
        logger.warning(
            "send_quote_email: client_email vacío para cotización %s",
            quote.quote_number,
        )
        return QuoteEmailLog.objects.create(
            quote=quote,
            recipient='',
            status='failed',
            error_message='El campo client_email de la cotización está vacío.',
        )

    # Validación 2: perfil de empresa completo
    if not company_profile.is_complete:
        logger.warning(
            "send_quote_email: perfil de empresa incompleto para cotización %s",
            quote.quote_number,
        )
        return QuoteEmailLog.objects.create(
            quote=quote,
            recipient=recipient,
            status='failed',
            error_message=(
                'El perfil de empresa está incompleto. '
                'Complete nombre, RUT y email antes de enviar.'
            ),
        )

    try:
        # Generar PDF
        from quotes.pdf_generator import generate_quote_pdf
        pdf_bytes = generate_quote_pdf(quote, company_profile)

        # Construir email
        subject = f"Cotización {quote.quote_number} - {company_profile.name}"
        body = (
            f"Estimado/a {quote.client_name or 'cliente'},\n\n"
            f"Adjunto encontrará la cotización N° {quote.quote_number} "
            f"emitida por {company_profile.name}.\n\n"
            f"Quedamos a su disposición para cualquier consulta.\n\n"
            f"Saludos cordiales,\n"
            f"{company_profile.name}\n"
            f"{company_profile.phone or ''}"
        )

        email = EmailMessage(
            subject=subject,
            body=body,
            from_email=company_profile.email,
            to=[recipient],
        )
        email.attach(
            filename=f"{quote.quote_number}.pdf",
            content=pdf_bytes,
            mimetype='application/pdf',
        )
        email.send(fail_silently=False)

        # Cambiar estado draft → sent
        if quote.status == 'draft':
            quote.status = 'sent'
            quote.status_updated_at = timezone.now()
            quote.save(update_fields=['status', 'status_updated_at'])

        logger.info(
            "send_quote_email: cotización %s enviada exitosamente a %s",
            quote.quote_number,
            recipient,
        )
        return QuoteEmailLog.objects.create(
            quote=quote,
            recipient=recipient,
            status='success',
        )

    except Exception as exc:
        logger.error(
            "send_quote_email: error enviando cotización %s a %s: %s",
            quote.quote_number,
            recipient,
            exc,
        )
        return QuoteEmailLog.objects.create(
            quote=quote,
            recipient=recipient,
            status='failed',
            error_message=str(exc),
        )
