import re
import base64
import html
import imghdr
from django.core.exceptions import ValidationError
from monaysolutions.config import MAX_COMPANY_LOGO_MB


def validate_rut(value):
    if not value:
        raise ValidationError('El RUT debe tener el formato XX.XXX.XXX-X')

    rut = str(value).strip().upper()
    pattern = r'^(\d{1,2}\.\d{3}\.\d{3}|\d{7,8})-[\dK]$'
    if not re.match(pattern, rut):
        raise ValidationError('El RUT debe tener el formato XX.XXX.XXX-X')

    body, verifier = rut.replace('.', '').split('-')
    total = 0
    multiplier = 2
    for digit in reversed(body):
        total += int(digit) * multiplier
        multiplier = 2 if multiplier == 7 else multiplier + 1

    remainder = 11 - (total % 11)
    expected = '0' if remainder == 11 else 'K' if remainder == 10 else str(remainder)
    if verifier != expected:
        raise ValidationError('El RUT ingresado no es válido.')

    formatted_body = re.sub(r'\B(?=(\d{3})+(?!\d))', '.', body)
    return f'{formatted_body}-{verifier}'


def validate_logo_base64(value):
    if not value:
        return
    try:
        raw = base64.b64decode(value)
    except Exception:
        raise ValidationError('El logo no es base64 válido')
    if len(raw) > MAX_COMPANY_LOGO_MB * 1024 * 1024:
        raise ValidationError(f'El logo debe ser PNG o JPEG y no superar {MAX_COMPANY_LOGO_MB} MB')
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
