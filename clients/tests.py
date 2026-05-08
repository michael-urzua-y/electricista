"""
Tests unitarios para el validador de RUT chileno.

Cubre:
  - RUTs válidos con y sin puntos
  - RUT con dígito verificador K
  - RUT con dígito verificador incorrecto
  - Formatos incorrectos
  - Entradas vacías y None
  - RutValidator (Django ValidationError)
"""

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from clients.validators import RutValidator, validate_rut


class ValidateRutValidCasesTest(SimpleTestCase):
    """RUTs que deben ser aceptados."""

    def test_rut_con_puntos_digito_numerico(self):
        """10.000.005-9 es un RUT válido con formato con puntos."""
        self.assertTrue(validate_rut("10.000.005-9"))

    def test_rut_sin_puntos_digito_numerico(self):
        """10000005-9 es el mismo RUT sin puntos, también válido."""
        self.assertTrue(validate_rut("10000005-9"))

    def test_rut_con_digito_k_mayuscula(self):
        """RUT cuyo dígito verificador es K (mayúscula): 10.000.013-K."""
        self.assertTrue(validate_rut("10.000.013-K"))

    def test_rut_con_digito_k_minuscula(self):
        """El dígito K en minúscula también debe ser aceptado."""
        self.assertTrue(validate_rut("10.000.013-k"))

    def test_rut_7_digitos_valido(self):
        """RUT de 7 dígitos en el cuerpo (ej. persona natural con RUT bajo)."""
        # 1.234.567-4 → verificamos con el algoritmo
        self.assertTrue(validate_rut("1.234.567-4"))

    def test_rut_con_espacios_al_inicio_y_final(self):
        """Los espacios al inicio y al final deben ignorarse."""
        self.assertTrue(validate_rut("  10.000.005-9  "))

    def test_rut_sin_puntos_8_digitos(self):
        """RUT de 8 dígitos sin puntos."""
        self.assertTrue(validate_rut("76354771-K"))

    def test_rut_conocido_empresa(self):
        """RUT de empresa conocido: 76.354.771-K."""
        self.assertTrue(validate_rut("76.354.771-K"))


class ValidateRutInvalidCheckDigitTest(SimpleTestCase):
    """RUTs con dígito verificador incorrecto."""

    def test_digito_verificador_incorrecto(self):
        """10.000.005-0 tiene dígito verificador incorrecto (correcto es 9)."""
        self.assertFalse(validate_rut("10.000.005-0"))

    def test_digito_verificador_incorrecto_sin_puntos(self):
        """10000005-1 tiene dígito verificador incorrecto."""
        self.assertFalse(validate_rut("10000005-1"))

    def test_k_donde_no_corresponde(self):
        """K como dígito verificador donde no corresponde (correcto es 9)."""
        self.assertFalse(validate_rut("10.000.005-K"))


class ValidateRutInvalidFormatTest(SimpleTestCase):
    """Entradas con formato incorrecto."""

    def test_sin_guion(self):
        """Sin guión separador → inválido."""
        self.assertFalse(validate_rut("123456789"))

    def test_cuerpo_no_numerico(self):
        """Cuerpo con letras → inválido."""
        self.assertFalse(validate_rut("AB.CDE.FGH-1"))

    def test_demasiados_digitos(self):
        """Cuerpo con más de 8 dígitos → inválido."""
        self.assertFalse(validate_rut("123456789-0"))

    def test_muy_pocos_digitos(self):
        """Cuerpo con menos de 7 dígitos → inválido."""
        self.assertFalse(validate_rut("12345-6"))

    def test_multiples_guiones(self):
        """Más de un guión → inválido."""
        self.assertFalse(validate_rut("12-345-678-9"))

    def test_digito_verificador_invalido(self):
        """Dígito verificador con carácter no permitido → inválido."""
        self.assertFalse(validate_rut("12.345.678-X"))


class ValidateRutEmptyAndNoneTest(SimpleTestCase):
    """Entradas vacías o None."""

    def test_cadena_vacia(self):
        """Cadena vacía → False."""
        self.assertFalse(validate_rut(""))

    def test_none(self):
        """None → False."""
        self.assertFalse(validate_rut(None))

    def test_solo_espacios(self):
        """Cadena con solo espacios → False."""
        self.assertFalse(validate_rut("   "))

    def test_solo_guion(self):
        """Solo un guión → False."""
        self.assertFalse(validate_rut("-"))


class RutValidatorDjangoTest(SimpleTestCase):
    """Tests para la clase RutValidator (integración con Django)."""

    def setUp(self):
        self.validator = RutValidator()

    def test_rut_valido_no_lanza_excepcion(self):
        """Un RUT válido no debe lanzar ValidationError."""
        try:
            self.validator("10.000.005-9")
        except ValidationError:
            self.fail("RutValidator lanzó ValidationError para un RUT válido.")

    def test_rut_invalido_lanza_validation_error(self):
        """Un RUT inválido debe lanzar ValidationError."""
        with self.assertRaises(ValidationError):
            self.validator("10.000.005-0")

    def test_rut_vacio_lanza_validation_error(self):
        """Una cadena vacía debe lanzar ValidationError."""
        with self.assertRaises(ValidationError):
            self.validator("")

    def test_mensaje_de_error_descriptivo(self):
        """El mensaje de error debe ser descriptivo."""
        with self.assertRaises(ValidationError) as ctx:
            self.validator("10.000.005-0")  # check digit incorrecto (correcto es 9)
        self.assertIn("RUT", ctx.exception.message)

    def test_codigo_de_error(self):
        """El código de error debe ser 'invalid_rut'."""
        with self.assertRaises(ValidationError) as ctx:
            self.validator("10.000.005-0")  # check digit incorrecto (correcto es 9)
        self.assertEqual(ctx.exception.code, "invalid_rut")
