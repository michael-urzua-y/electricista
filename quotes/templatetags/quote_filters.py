from django import template

register = template.Library()


@register.filter
def clp(value):
    """Formatea un número como moneda chilena: separador de miles con punto, sin decimales.
    Ejemplo: 100000 → 100.000
    """
    try:
        num = int(round(float(value)))
        if num < 0:
            return f"-{abs(num):,}".replace(",", ".")
        return f"{num:,}".replace(",", ".")
    except (ValueError, TypeError):
        return "0"


@register.filter
def qty(value):
    """Formatea cantidad como entero (sin decimales).
    Ejemplo: 1.00 → 1
    """
    try:
        num = float(value)
        if num == int(num):
            return str(int(num))
        return str(num)
    except (ValueError, TypeError):
        return "0"
