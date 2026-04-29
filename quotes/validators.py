import re
import base64
import html
import imghdr
from django.core.exceptions import ValidationError


def validate_rut(value):
    pattern = r'^\d{7,8}-[\dkK]$'
    if not re.match(pattern, value):
        raise ValidationError('El RUT debe tener el formato XXXXXXXX-X')


def validate_logo_base64(value):
    if not value:
        return
    try:
        raw = base64.b64decode(value)
    except Exception:
        raise ValidationError('El logo no es base64 válido')
    if len(raw) > 2 * 1024 * 1024:
        raise ValidationError('El logo debe ser PNG o JPEG y no superar 2 MB')
    img_type = imghdr.what(None, h=raw)
    if img_type not in ('png', 'jpeg'):
        raise ValidationError('El logo debe ser PNG o JPEG y no superar 2 MB')


def validate_positive_decimal(value):
    if value is not None and value <= 0:
        raise ValidationError('El valor debe ser mayor que cero')


def validate_text_safe(value):
    if value:
        return html.escape(value)
    return value
