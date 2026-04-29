import base64
from django.template.loader import render_to_string
from weasyprint import HTML


def generate_quote_pdf(quote, company_profile) -> bytes:
    context = {
        'quote': quote,
        'items': quote.items.select_related('product').all(),
        'company': company_profile,
        'logo_src': _logo_data_uri(company_profile.logo_base64),
    }
    html_string = render_to_string('quotes/quote_pdf.html', context)
    pdf_bytes = HTML(string=html_string, base_url=None).write_pdf()
    return pdf_bytes


def _logo_data_uri(logo_base64: str) -> str:
    if not logo_base64:
        return ''
    try:
        raw = base64.b64decode(logo_base64[:16])
        mime = 'image/png' if raw[:4] == b'\x89PNG' else 'image/jpeg'
        return f'data:{mime};base64,{logo_base64}'
    except Exception:
        return ''
