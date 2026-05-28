from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from .validators import validate_rut


class CompanyProfileRutValidationTests(SimpleTestCase):
    def test_accepts_input_format_with_points(self):
        self.assertEqual(validate_rut('78.200.686-K'), '78.200.686-K')

    def test_normalizes_unformatted_rut(self):
        self.assertEqual(validate_rut('78200686-K'), '78.200.686-K')

    def test_rejects_format_without_hyphen_with_input_format_message(self):
        with self.assertRaises(ValidationError) as ctx:
            validate_rut('78200686K')

        self.assertIn('XX.XXX.XXX-X', str(ctx.exception))

    def test_rejects_invalid_verifier(self):
        with self.assertRaises(ValidationError) as ctx:
            validate_rut('78.200.686-0')

        self.assertIn('no es válido', str(ctx.exception))
