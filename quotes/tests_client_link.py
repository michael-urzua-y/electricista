"""
Tests for Task 4: Vincular Quote con Client
Verifies that QuoteCreateSerializer correctly handles client_id,
auto-populates snapshot fields, and enforces ownership validation.

Non-DB tests run locally.
DB tests require the Docker PostgreSQL service (run inside the container).
"""
import pytest
from quotes.serializers import QuoteCreateSerializer, QuoteDetailSerializer, QuoteListSerializer


# ---------------------------------------------------------------------------
# Non-DB tests — verify field declarations (no database required)
# ---------------------------------------------------------------------------

class TestQuoteCreateSerializerClientId:
    def test_client_id_field_is_optional_write_only(self):
        """client_id must be optional and write-only in QuoteCreateSerializer."""
        s = QuoteCreateSerializer()
        assert 'client_id' in s.fields
        assert s.fields['client_id'].write_only is True
        assert s.fields['client_id'].required is False

    def test_client_id_allows_null(self):
        """client_id must accept null values (optional FK)."""
        s = QuoteCreateSerializer()
        assert s.fields['client_id'].allow_null is True


class TestQuoteDetailSerializerClientId:
    def test_client_id_in_fields(self):
        """client_id must be present in QuoteDetailSerializer."""
        s = QuoteDetailSerializer()
        assert 'client_id' in s.fields

    def test_client_id_is_read_only(self):
        """client_id must be read-only in QuoteDetailSerializer."""
        s = QuoteDetailSerializer()
        assert s.fields['client_id'].read_only is True

    def test_snapshot_fields_present(self):
        """Snapshot fields client_name, client_rut, client_email must be present."""
        s = QuoteDetailSerializer()
        for field in ('client_name', 'client_rut', 'client_email'):
            assert field in s.fields, f'{field} missing from QuoteDetailSerializer'


class TestQuoteListSerializerClientId:
    def test_client_id_in_fields(self):
        """client_id must be present in QuoteListSerializer."""
        s = QuoteListSerializer()
        assert 'client_id' in s.fields

    def test_client_name_still_present(self):
        """client_name must still be present in QuoteListSerializer."""
        s = QuoteListSerializer()
        assert 'client_name' in s.fields


# ---------------------------------------------------------------------------
# DB tests — require Docker PostgreSQL (run with: docker-compose exec web pytest)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestQuoteCreateSerializerWithDb:
    """
    These tests require a live database connection.
    Run inside Docker: docker-compose exec web pytest quotes/tests_client_link.py -v
    """

    def _make_request(self, factory, user):
        from rest_framework.test import APIRequestFactory
        request = factory.post('/')
        request.user = user
        return request

    ITEM_DATA = [
        {
            'product': None,
            'quantity': '2.00',
            'unit_price': '1000.00',
            'product_name_override': 'Cable 2.5mm',
            'unit_override': 'metro',
        }
    ]

    def test_create_without_client_id_still_works(self, django_user_model):
        from rest_framework.test import APIRequestFactory
        user = django_user_model.objects.create_user(username='u1', password='pass')
        factory = APIRequestFactory()
        request = self._make_request(factory, user)
        data = {
            'client_name': 'Sin Cliente',
            'client_rut': '',
            'client_email': '',
            'notes': '',
            'valid_until': None,
            'items': self.ITEM_DATA,
        }
        s = QuoteCreateSerializer(data=data, context={'request': request})
        assert s.is_valid(), s.errors
        quote = s.save(user=user)
        assert quote.client is None
        assert quote.client_name == 'Sin Cliente'

    def test_create_with_client_id_auto_populates_snapshot_fields(self, django_user_model):
        from rest_framework.test import APIRequestFactory
        from clients.models import Client
        user = django_user_model.objects.create_user(username='u2', password='pass')
        client_obj = Client.objects.create(
            user=user, rut='12.345.678-9', name='Juan Pérez', email='juan@example.com'
        )
        factory = APIRequestFactory()
        request = self._make_request(factory, user)
        data = {
            'client_id': client_obj.pk,
            'client_name': '',
            'client_rut': '',
            'client_email': '',
            'notes': '',
            'valid_until': None,
            'items': self.ITEM_DATA,
        }
        s = QuoteCreateSerializer(data=data, context={'request': request})
        assert s.is_valid(), s.errors
        quote = s.save(user=user)
        assert quote.client == client_obj
        assert quote.client_name == client_obj.name
        assert quote.client_rut == client_obj.rut
        assert quote.client_email == client_obj.email

    def test_client_id_from_other_user_raises_validation_error(self, django_user_model):
        from rest_framework.test import APIRequestFactory
        from clients.models import Client
        user = django_user_model.objects.create_user(username='u3', password='pass')
        other_user = django_user_model.objects.create_user(username='u4', password='pass')
        other_client = Client.objects.create(
            user=other_user, rut='98.765.432-1', name='Otro', email='otro@example.com'
        )
        factory = APIRequestFactory()
        request = self._make_request(factory, user)
        data = {
            'client_id': other_client.pk,
            'notes': '',
            'valid_until': None,
            'items': self.ITEM_DATA,
        }
        s = QuoteCreateSerializer(data=data, context={'request': request})
        assert not s.is_valid()
        assert 'client_id' in s.errors
