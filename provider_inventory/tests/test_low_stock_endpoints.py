"""
Tests for Task 8: Endpoints de stock bajo
Verifies that the low stock endpoints work correctly.
"""
import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from invoices.models import Invoice, InvoiceItem
from provider_inventory.models import ProviderInventory, ProviderInventoryAuditLog
from provider_inventory.services import InvoiceProcessingService
from products.models import Provider


User = get_user_model()


@pytest.fixture
def api_client():
    """Create an API client."""
    return APIClient()


@pytest.fixture
def user():
    """Create a test user."""
    return User.objects.create_user(username='testuser', password='testpass123')


@pytest.fixture
def provider():
    """Create a test provider."""
    return Provider.objects.create(
        name='Test Provider',
        rut='12.345.678-9',
    )


@pytest.mark.django_db
class TestLowStockListEndpoint:
    """Tests for GET /api/inventory/low-stock/ endpoint."""

    def test_endpoint_requires_authentication(self, api_client):
        """Endpoint should require authentication."""
        response = api_client.get('/api/inventory/low-stock/')
        assert response.status_code == 401

    def test_returns_empty_list_when_no_low_stock_items(self, api_client, user, provider):
        """Should return empty results when no items have low stock."""
        api_client.force_authenticate(user=user)
        
        # Create item with sufficient stock
        ProviderInventory.objects.create(
            product_name='Cable 2.5mm',
            provider=provider,
            stock_quantity=Decimal('100.00'),
            minimum_stock=Decimal('10.00'),
            unit_price=Decimal('500.00'),
        )
        
        response = api_client.get('/api/inventory/low-stock/')
        assert response.status_code == 200
        assert response.data['count'] == 0
        assert len(response.data['results']) == 0

    def test_returns_items_with_stock_below_minimum(self, api_client, user, provider):
        """Should return items where stock_quantity < minimum_stock."""
        api_client.force_authenticate(user=user)
        
        # Create low stock item
        low_stock_item = ProviderInventory.objects.create(
            product_name='Cable 2.5mm',
            provider=provider,
            stock_quantity=Decimal('5.00'),
            minimum_stock=Decimal('10.00'),
            unit_price=Decimal('500.00'),
        )
        
        # Create normal stock item
        ProviderInventory.objects.create(
            product_name='Cable 4mm',
            provider=provider,
            stock_quantity=Decimal('100.00'),
            minimum_stock=Decimal('10.00'),
            unit_price=Decimal('700.00'),
        )
        
        response = api_client.get('/api/inventory/low-stock/')
        assert response.status_code == 200
        assert response.data['count'] == 1
        assert len(response.data['results']) == 1
        assert response.data['results'][0]['id'] == low_stock_item.id

    def test_excludes_items_without_minimum_stock_configured(self, api_client, user, provider):
        """Should exclude items where minimum_stock is NULL."""
        api_client.force_authenticate(user=user)
        
        # Create item without minimum_stock
        ProviderInventory.objects.create(
            product_name='Cable 2.5mm',
            provider=provider,
            stock_quantity=Decimal('5.00'),
            minimum_stock=None,
            unit_price=Decimal('500.00'),
        )
        
        response = api_client.get('/api/inventory/low-stock/')
        assert response.status_code == 200
        assert response.data['count'] == 0

    def test_response_includes_required_fields(self, api_client, user, provider):
        """Response should include all required fields."""
        api_client.force_authenticate(user=user)
        
        ProviderInventory.objects.create(
            product_name='Cable 2.5mm',
            provider=provider,
            stock_quantity=Decimal('5.00'),
            minimum_stock=Decimal('10.00'),
            unit_price=Decimal('500.00'),
            unit_measure='metro',
        )
        
        response = api_client.get('/api/inventory/low-stock/')
        assert response.status_code == 200
        item = response.data['results'][0]
        
        # Check required fields
        assert 'id' in item
        assert 'product_name' in item
        assert 'provider_name' in item
        assert 'stock_quantity' in item
        assert 'minimum_stock' in item
        assert 'cheapest_price' in item
        assert 'unit_measure' in item
        
        assert item['product_name'] == 'Cable 2.5mm'
        assert item['provider_name'] == 'Test Provider'
        assert item['unit_measure'] == 'metro'

    def test_cheapest_price_annotation(self, api_client, user):
        """Should annotate cheapest_price from all providers with same product."""
        api_client.force_authenticate(user=user)
        
        provider1 = Provider.objects.create(name='Provider 1', rut='11.111.111-1')
        provider2 = Provider.objects.create(name='Provider 2', rut='22.222.222-2')
        
        # Same product from two providers with different prices
        ProviderInventory.objects.create(
            product_name='Cable 2.5mm',
            provider=provider1,
            stock_quantity=Decimal('5.00'),
            minimum_stock=Decimal('10.00'),
            unit_price=Decimal('500.00'),
        )
        
        ProviderInventory.objects.create(
            product_name='Cable 2.5mm',
            provider=provider2,
            stock_quantity=Decimal('15.00'),
            minimum_stock=Decimal('10.00'),
            unit_price=Decimal('450.00'),  # Cheaper
        )
        
        response = api_client.get('/api/inventory/low-stock/')
        assert response.status_code == 200
        assert response.data['count'] == 1
        
        # Should show cheapest price (450.00) even though this item costs 500.00
        item = response.data['results'][0]
        assert Decimal(item['cheapest_price']) == Decimal('450.00')

    def test_pagination_with_50_items_per_page(self, api_client, user, provider):
        """Should paginate with 50 items per page."""
        api_client.force_authenticate(user=user)
        
        # Create 60 low stock items
        for i in range(60):
            ProviderInventory.objects.create(
                product_name=f'Product {i}',
                provider=provider,
                stock_quantity=Decimal('1.00'),
                minimum_stock=Decimal('10.00'),
                unit_price=Decimal('100.00'),
            )
        
        response = api_client.get('/api/inventory/low-stock/')
        assert response.status_code == 200
        assert response.data['count'] == 60
        assert len(response.data['results']) == 50
        assert response.data['next'] is not None
        assert response.data['previous'] is None
        
        # Get second page
        response = api_client.get('/api/inventory/low-stock/?page=2')
        assert response.status_code == 200
        assert len(response.data['results']) == 10
        assert response.data['next'] is None
        assert response.data['previous'] is not None


@pytest.mark.django_db
class TestLowStockCountEndpoint:
    """Tests for GET /api/inventory/low-stock/count/ endpoint."""

    def test_endpoint_requires_authentication(self, api_client):
        """Endpoint should require authentication."""
        response = api_client.get('/api/inventory/low-stock/count/')
        assert response.status_code == 401

    def test_returns_zero_when_no_low_stock_items(self, api_client, user, provider):
        """Should return count of 0 when no items have low stock."""
        api_client.force_authenticate(user=user)
        
        ProviderInventory.objects.create(
            product_name='Cable 2.5mm',
            provider=provider,
            stock_quantity=Decimal('100.00'),
            minimum_stock=Decimal('10.00'),
        )
        
        response = api_client.get('/api/inventory/low-stock/count/')
        assert response.status_code == 200
        assert response.data == {'count': 0}

    def test_returns_correct_count(self, api_client, user, provider):
        """Should return correct count of low stock items."""
        api_client.force_authenticate(user=user)
        
        # Create 3 low stock items
        for i in range(3):
            ProviderInventory.objects.create(
                product_name=f'Product {i}',
                provider=provider,
                stock_quantity=Decimal('1.00'),
                minimum_stock=Decimal('10.00'),
            )
        
        # Create 2 normal stock items
        for i in range(2):
            ProviderInventory.objects.create(
                product_name=f'Normal Product {i}',
                provider=provider,
                stock_quantity=Decimal('100.00'),
                minimum_stock=Decimal('10.00'),
            )
        
        response = api_client.get('/api/inventory/low-stock/count/')
        assert response.status_code == 200
        assert response.data == {'count': 3}

    def test_response_format(self, api_client, user, provider):
        """Response should only contain count field."""
        api_client.force_authenticate(user=user)
        
        ProviderInventory.objects.create(
            product_name='Cable 2.5mm',
            provider=provider,
            stock_quantity=Decimal('5.00'),
            minimum_stock=Decimal('10.00'),
        )

        response = api_client.get('/api/inventory/low-stock/count/')
        assert response.status_code == 200
        assert set(response.data.keys()) == {'count'}
        assert isinstance(response.data['count'], int)


@pytest.mark.django_db
def test_invoice_inventory_processing_is_idempotent(user, provider):
    """Reprocessing the same invoice item should not duplicate stock."""
    invoice = Invoice.objects.create(
        user=user,
        provider=provider,
        invoice_number='F-001',
        issue_date='2026-05-26',
        status='processing',
    )
    item = InvoiceItem.objects.create(
        invoice=invoice,
        description='Cable 2.5mm',
        quantity=Decimal('2.00'),
        unit_price=Decimal('500.00'),
        total_price=Decimal('1000.00'),
        unit_measure='metro',
    )

    first = InvoiceProcessingService.process_invoice(invoice.id)
    second = InvoiceProcessingService.process_invoice(invoice.id)

    inventory = ProviderInventory.objects.get(
        product_name='Cable 2.5mm',
        provider=provider,
    )
    assert inventory.stock_quantity == Decimal('2.00')
    assert first['items_created'] == 1
    assert second['items_skipped'] == 1
    assert ProviderInventoryAuditLog.objects.filter(
        inventory=inventory,
        invoice_id=invoice.id,
        invoice_item_id=item.id,
    ).count() == 1
