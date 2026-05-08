"""
Validador de RUT chileno.

Soporta los formatos:
  - Con puntos:    12.345.678-9
  - Sin puntos:    12345678-9
  - Dígito K:      12.345.678-K  /  12345678-K

Algoritmo módulo 11:
  1. Tomar los dígitos del cuerpo (sin puntos ni guión).
  2. Multiplicar cada dígito de derecha a izquierda por la secuencia [2, 3, 4, 5, 6, 7, 2, 3, ...].
  3. Sumar los productos.
  4. Calcular 11 - (suma % 11).
  5. Mapear: 11 → '0', 10 → 'K', resto → str(resultado).
  6. Comparar con el dígito verificador ingresado (case-insensitive).
"""

from django.core.exceptions import ValidationError


def validate_rut(rut: str) -> bool:
    """
    Valida un RUT chileno.

    Acepta los formatos ``XX.XXX.XXX-X`` y ``XXXXXXXX-X`` (con o sin puntos).
    Devuelve ``True`` si el RUT es válido, ``False`` en cualquier otro caso
    (entrada vacía, None, formato incorrecto, dígito verificador incorrecto).
    No lanza excepciones.
    """
    if not rut:
        return False

    try:
        # Normalizar: quitar espacios y puntos, convertir a mayúsculas
        cleaned = rut.strip().replace(".", "").upper()

        # Debe contener exactamente un guión
        if cleaned.count("-") != 1:
            return False

        body, check_digit = cleaned.split("-")

        # El cuerpo debe ser numérico y tener entre 7 y 8 dígitos
        if not body.isdigit() or not (7 <= len(body) <= 8):
            return False

        # El dígito verificador debe ser un dígito o la letra K
        if check_digit not in "0123456789K":
            return False

        # Calcular dígito verificador esperado
        expected = _compute_check_digit(body)

        return check_digit == expected

    except Exception:
        return False


def _compute_check_digit(body: str) -> str:
    """
    Calcula el dígito verificador para el cuerpo numérico de un RUT.

    :param body: Cadena de dígitos del cuerpo (sin puntos ni guión).
    :returns: Dígito verificador como string ('0'–'9' o 'K').
    """
    multipliers = [2, 3, 4, 5, 6, 7]
    total = 0
    for i, digit in enumerate(reversed(body)):
        total += int(digit) * multipliers[i % len(multipliers)]

    remainder = 11 - (total % 11)

    if remainder == 11:
        return "0"
    if remainder == 10:
        return "K"
    return str(remainder)


class RutValidator:
    """
    Validador Django para campos de modelo y serializador.

    Uso en modelo::

        rut = models.CharField(max_length=12, validators=[RutValidator()])

    Uso en serializer::

        rut = serializers.CharField(validators=[RutValidator()])
    """

    message = "El RUT ingresado no es válido. Use el formato XX.XXX.XXX-X o XXXXXXXX-X."
    code = "invalid_rut"

    def __call__(self, value: str) -> None:
        if not validate_rut(value):
            raise ValidationError(self.message, code=self.code)
