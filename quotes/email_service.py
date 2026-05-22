"""
Servicio de envío de cotizaciones por email.
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from django.core.mail import EmailMessage
from django.utils import timezone

from quotes.models import Quote, QuoteEmailLog

logger = logging.getLogger(__name__)


def _send_via_smtplib(smtp_config, subject, body, from_email, to, pdf_bytes, filename):
    """Envía el correo usando smtplib directamente con la configuración SMTP del usuario."""
    msg = MIMEMultipart('mixed')
    msg['From'] = from_email
    msg['To'] = to
    msg['Subject'] = subject

    msg.attach(MIMEText(body, 'plain', 'utf-8'))

    part = MIMEBase('application', 'octet-stream')
    part.set_payload(pdf_bytes)
    encoders.encode_base64(part)
    part.add_header(
        'Content-Disposition', f'attachment; filename="{filename}"'
    )
    msg.attach(part)

    if smtp_config.use_ssl:
        server = smtplib.SMTP_SSL(smtp_config.smtp_host, smtp_config.smtp_port, timeout=30)
    else:
        server = smtplib.SMTP(smtp_config.smtp_host, smtp_config.smtp_port, timeout=30)
        if smtp_config.use_tls:
            server.starttls()

    try:
        server.login(smtp_config.smtp_user, smtp_config.smtp_password)
        server.sendmail(smtp_config.smtp_user, [to], msg.as_string())
    finally:
        server.quit()


def send_quote_email(quote: Quote, company_profile, user, smtp_config=None) -> QuoteEmailLog:
    """
    Envía la cotización en PDF al email del cliente.

    Flujo:
    1. Valida que quote.client_email no esté vacío.
    2. Valida que company_profile.is_complete.
    3. Genera el PDF con generate_quote_pdf().
    4. Si hay smtp_config, envía usando smtplib con esas credenciales.
       Si no, envía usando el backend de Django.
    5. Si es exitoso y la cotización está en 'draft', cambia el estado a 'sent'.
    6. Registra y retorna un QuoteEmailLog con el resultado.

    :param quote: Instancia de Quote a enviar.
    :param company_profile: Instancia de CompanyProfile del usuario.
    :param user: Usuario autenticado (para logging).
    :param smtp_config: Instancia de SMTPConfig del usuario (opcional).
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
        from_email = smtp_config.smtp_user if smtp_config else company_profile.email
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

        if smtp_config:
            # Envío directo por SMTP del usuario
            _send_via_smtplib(
                smtp_config=smtp_config,
                subject=subject,
                body=body,
                from_email=from_email,
                to=recipient,
                pdf_bytes=pdf_bytes,
                filename=f"{quote.quote_number}.pdf",
            )
        else:
            # Envío por backend de Django (SMTP global o consola)
            email = EmailMessage(
                subject=subject,
                body=body,
                from_email=from_email,
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
