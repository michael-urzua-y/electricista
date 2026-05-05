import base64
from django.template.loader import render_to_string
from weasyprint import HTML


def generate_quote_pdf(quote, company_profile) -> bytes:
    context = {
        'quote': quote,
        'items': quote.items.select_related('product').all(),
        'company': company_profile,
        'logo_src': _logo_data_uri(company_profile),
    }
    html_string = render_to_string('quotes/quote_pdf.html', context)
    pdf_bytes = HTML(string=html_string, base_url=None).write_pdf()
    return pdf_bytes


def _logo_data_uri(company_profile) -> str:
    """
    Genera un data URI del logo.
    Prioriza logo_data (binario). Fallback a logo_base64 (legacy).
    """
    # Preferir logo binario
    if company_profile.logo_data:
        try:
            data = bytes(company_profile.logo_data)
            mime = company_profile.logo_mime or 'image/png'
            b64 = base64.b64encode(data).decode('ascii')
            return f'data:{mime};base64,{b64}'
        except Exception:
            pass

    # Fallback a base64 legacy
    if company_profile.logo_base64:
        try:
            raw = base64.b64decode(company_profile.logo_base64[:16])
            mime = 'image/png' if raw[:4] == b'\x89PNG' else 'image/jpeg'
            return f'data:{mime};base64,{company_profile.logo_base64}'
        except Exception:
            pass

    return ''
