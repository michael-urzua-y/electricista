"""
Pytest configuration y fixtures para provider_inventory tests.
"""
import pytest
from decimal import Decimal
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from products.models import Provider
from quotes.models import Quote
from invoices.models import Invoice
from provider_inventory.models import ProviderInventory
from provider_inventory.signals import process_invoice_on_completion


@pytest.fixture(autouse=True)
def disable_signals(db):
    """Desactivar signals durante los tests para evitar efectos secundarios."""
    post_save.disconnect(process_invoice_on_completion, sender=Invoice)
    yield
    post_save.connect(process_invoice_on_completion, sender=Invoice)


@pytest.fixture
def test_user(db):
    """Crea un usuario de prueba."""
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123'
    )


@pytest.fixture
def test_provider(db):
    """Crea un proveedor de prueba."""
    return Provider.objects.create(
        name='Proveedor Test',
        category='general',
        is_active=True
    )


@pytest.fixture
def test_inventory(db, test_provider):
    """Crea un inventario de prueba."""
    return ProviderInventory.objects.create(
        product_name='Cable Eléctrico 2.5mm',
        provider=test_provider,
        stock_quantity=Decimal('1000.0'),
        unit_price=Decimal('1500.00'),
        unit_measure='metro'
    )


@pytest.fixture
def test_quote(db, test_user):
    """Crea una cotización de prueba."""
    return Quote.objects.create(
        user=test_user,
        quote_number='Q-001',
        status='draft'
    )


@pytest.fixture
def test_invoice(db, test_user, test_provider):
    """Crea una factura de prueba."""
    return Invoice.objects.create(
        user=test_user,
        provider=test_provider,
        invoice_number='INV-001',
        status='completed'
    )
