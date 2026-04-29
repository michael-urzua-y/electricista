"""
Tests unitarios para servicios de provider_inventory.
"""
import pytest
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone

from products.models import Provider
from quotes.models import Quote, QuoteItem
from invoices.models import Invoice, InvoiceItem
from provider_inventory.models import (
    ProviderInventory,
    ProviderInventoryAuditLog,
    StockReservation,
    ProviderInventoryPriceHistory,
)
from provider_inventory.services import (
    InventoryService,
    InvoiceProcessingService,
    StockReservationService,
    AuditService,
)


class InventoryServiceTestCase(TestCase):
    """Tests para InventoryService."""
    
    def setUp(self):
        """Configuración inicial para cada test."""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        
        self.provider = Provider.objects.create(
            name='Proveedor Test',
            category='general',
            is_active=True
        )
        
        self.inventory = ProviderInventory.objects.create(
            product_name='Cable Eléctrico 2.5mm',
            provider=self.provider,
            stock_quantity=Decimal('100.0'),
            unit_price=Decimal('1500.00'),
            unit_measure='metro'
        )
        
        self.quote = Quote.objects.create(
            user=self.user,
            quote_number='Q-001',
            status='draft'
        )
    
    def test_search_with_valid_product_name(self):
        """Test búsqueda con nombre de producto válido."""
        result = InventoryService.search('Cable', limit=10, offset=0)
        
        self.assertEqual(result['count'], 1)
        self.assertEqual(len(result['results']), 1)
        self.assertEqual(result['results'][0]['product_name'], 'Cable Eléctrico 2.5mm')
    
    def test_search_case_insensitive(self):
        """Test búsqueda case-insensitive."""
        result = InventoryService.search('cable', limit=10, offset=0)
        
        self.assertEqual(result['count'], 1)
        self.assertEqual(len(result['results']), 1)
    
    def test_search_partial_match(self):
        """Test búsqueda con partial match."""
        result = InventoryService.search('Eléc', limit=10, offset=0)
        
        self.assertEqual(result['count'], 1)
    
    def test_search_filters_zero_stock(self):
        """Test que búsqueda filtra items con stock = 0."""
        # Crear item con stock 0
        ProviderInventory.objects.create(
            product_name='Cable Agotado',
            provider=self.provider,
            stock_quantity=Decimal('0'),
            unit_measure='metro'
        )
        
        result = InventoryService.search('Cable', limit=10, offset=0)
        
        # Solo debe retornar el item con stock > 0
        self.assertEqual(result['count'], 1)
    
    def test_search_minimum_length_validation(self):
        """Test validación de longitud mínima."""
        with self.assertRaises(ValueError):
            InventoryService.search('C', limit=10, offset=0)
    
    def test_validate_stock_sufficient(self):
        """Test validación de stock suficiente."""
        result = InventoryService.validate_stock(
            self.inventory.id,
            Decimal('50.0')
        )
        
        self.assertTrue(result)
    
    def test_validate_stock_insufficient(self):
        """Test validación de stock insuficiente."""
        with self.assertRaises(ValueError):
            InventoryService.validate_stock(
                self.inventory.id,
                Decimal('150.0')
            )
    
    def test_add_to_quote_decrements_stock(self):
        """Test que agregar a cotización decrementa stock."""
        initial_stock = self.inventory.stock_quantity
        
        reservation = InventoryService.add_to_quote(
            quote_id=self.quote.id,
            inventory_id=self.inventory.id,
            quantity=Decimal('50.0'),
            user=self.user
        )
        
        # Verificar que stock se decrementó
        self.inventory.refresh_from_db()
        self.assertEqual(
            self.inventory.stock_quantity,
            initial_stock - Decimal('50.0')
        )
        
        # Verificar que se creó la reserva
        self.assertEqual(reservation.quantity_reserved, Decimal('50.0'))
        self.assertEqual(reservation.status, 'reserved')
    
    def test_add_to_quote_creates_audit_log(self):
        """Test que agregar a cotización crea audit log."""
        InventoryService.add_to_quote(
            quote_id=self.quote.id,
            inventory_id=self.inventory.id,
            quantity=Decimal('50.0'),
            user=self.user
        )
        
        # Verificar que se creó el audit log
        logs = ProviderInventoryAuditLog.objects.filter(
            inventory=self.inventory,
            action='decrement'
        )
        self.assertEqual(logs.count(), 1)
        self.assertEqual(logs.first().quantity_changed, Decimal('-50.0'))
    
    def test_add_to_quote_insufficient_stock(self):
        """Test que agregar a cotización falla con stock insuficiente."""
        with self.assertRaises(ValueError):
            InventoryService.add_to_quote(
                quote_id=self.quote.id,
                inventory_id=self.inventory.id,
                quantity=Decimal('150.0'),
                user=self.user
            )
    
    def test_remove_from_quote_restores_stock(self):
        """Test que remover de cotización restaura stock."""
        # Primero agregar
        initial_stock = self.inventory.stock_quantity
        
        reservation = InventoryService.add_to_quote(
            quote_id=self.quote.id,
            inventory_id=self.inventory.id,
            quantity=Decimal('50.0'),
            user=self.user
        )
        
        # Verificar que stock se decrementó
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.stock_quantity, initial_stock - Decimal('50.0'))
        
        # Luego remover
        quantity_restored = InventoryService.remove_from_quote(
            quote_item_id=reservation.quote_item_id,
            user=self.user
        )
        
        # Verificar que stock se restauró al valor inicial
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.stock_quantity, initial_stock)
        self.assertEqual(quantity_restored, Decimal('50.0'))


class InvoiceProcessingServiceTestCase(TestCase):
    """Tests para InvoiceProcessingService."""
    
    def setUp(self):
        """Configuración inicial para cada test."""
        self.provider = Provider.objects.create(
            name='Proveedor Test',
            category='general',
            is_active=True
        )
        
        self.invoice = Invoice.objects.create(
            user=User.objects.create_user('testuser', 'test@example.com', 'pass'),
            provider=self.provider,
            invoice_number='INV-001',
            status='completed'
        )
    
    def test_process_invoice_item_creates_inventory(self):
        """Test que procesar ítem de factura crea inventario."""
        item = InvoiceItem.objects.create(
            invoice=self.invoice,
            description='Cable Nuevo',
            quantity=Decimal('100.0'),
            unit_price=Decimal('1500.00'),
            unit_measure='metro'
        )
        
        result = InvoiceProcessingService.process_invoice_item(item, self.invoice)
        
        self.assertEqual(result['status'], 'created')
        self.assertEqual(result['product_name'], 'Cable Nuevo')
        
        # Verificar que se creó el inventario
        inventory = ProviderInventory.objects.get(
            product_name='Cable Nuevo',
            provider=self.provider
        )
        self.assertEqual(inventory.stock_quantity, Decimal('100.0'))
    
    def test_process_invoice_item_increments_existing_inventory(self):
        """Test que procesar ítem incrementa inventario existente."""
        # Crear inventario existente
        inventory = ProviderInventory.objects.create(
            product_name='Cable Existente',
            provider=self.provider,
            stock_quantity=Decimal('50.0'),
            unit_price=Decimal('1500.00'),
            unit_measure='metro'
        )
        
        # Crear ítem de factura
        item = InvoiceItem.objects.create(
            invoice=self.invoice,
            description='Cable Existente',
            quantity=Decimal('100.0'),
            unit_price=Decimal('1500.00'),
            unit_measure='metro'
        )
        
        result = InvoiceProcessingService.process_invoice_item(item, self.invoice)
        
        self.assertEqual(result['status'], 'matched')
        
        # Verificar que se incrementó el stock
        inventory.refresh_from_db()
        self.assertEqual(inventory.stock_quantity, Decimal('150.0'))
    
    def test_process_invoice_item_updates_price(self):
        """Test que procesar ítem actualiza precio si es más reciente."""
        # Crear inventario con precio antiguo
        inventory = ProviderInventory.objects.create(
            product_name='Cable Precio',
            provider=self.provider,
            stock_quantity=Decimal('50.0'),
            unit_price=Decimal('1000.00'),
            unit_measure='metro'
        )
        
        # Crear ítem con precio más alto
        item = InvoiceItem.objects.create(
            invoice=self.invoice,
            description='Cable Precio',
            quantity=Decimal('100.0'),
            unit_price=Decimal('1500.00'),
            unit_measure='metro'
        )
        
        InvoiceProcessingService.process_invoice_item(item, self.invoice)
        
        # Verificar que se actualizó el precio
        inventory.refresh_from_db()
        self.assertEqual(inventory.unit_price, Decimal('1500.00'))
    
    def test_process_invoice_item_creates_price_history(self):
        """Test que procesar ítem crea historial de precio."""
        item = InvoiceItem.objects.create(
            invoice=self.invoice,
            description='Cable Historial',
            quantity=Decimal('100.0'),
            unit_price=Decimal('1500.00'),
            unit_measure='metro'
        )
        
        InvoiceProcessingService.process_invoice_item(item, self.invoice)
        
        # Verificar que se creó el historial
        history = ProviderInventoryPriceHistory.objects.filter(
            unit_price=Decimal('1500.00')
        )
        self.assertEqual(history.count(), 1)
        self.assertEqual(history.first().source, 'invoice')


class AuditServiceTestCase(TestCase):
    """Tests para AuditService."""
    
    def setUp(self):
        """Configuración inicial para cada test."""
        self.user = User.objects.create_user('testuser', 'test@example.com', 'pass')
        
        self.provider = Provider.objects.create(
            name='Proveedor Test',
            category='general',
            is_active=True
        )
        
        self.inventory = ProviderInventory.objects.create(
            product_name='Cable Test',
            provider=self.provider,
            stock_quantity=Decimal('100.0'),
            unit_measure='metro'
        )
    
    def test_log_stock_change_creates_audit_log(self):
        """Test que log_stock_change crea audit log."""
        log = AuditService.log_stock_change(
            inventory_id=self.inventory.id,
            action='increment',
            quantity_before=Decimal('100.0'),
            quantity_after=Decimal('150.0'),
            source='invoice',
            user=self.user,
            invoice_id=1,
        )
        
        self.assertEqual(log.action, 'increment')
        self.assertEqual(log.quantity_changed, Decimal('50.0'))
        self.assertEqual(log.source, 'invoice')
    
    def test_query_audit_logs_returns_results(self):
        """Test que query_audit_logs retorna resultados."""
        # Crear algunos logs
        for i in range(5):
            AuditService.log_stock_change(
                inventory_id=self.inventory.id,
                action='increment',
                quantity_before=Decimal('100.0'),
                quantity_after=Decimal('150.0'),
                source='invoice',
                user=self.user,
            )
        
        result = AuditService.query_audit_logs(limit=10, offset=0)
        
        self.assertEqual(result['count'], 5)
        self.assertEqual(len(result['results']), 5)
    
    def test_query_audit_logs_filters_by_user(self):
        """Test que query_audit_logs filtra por usuario."""
        other_user = User.objects.create_user('other', 'other@example.com', 'pass')
        
        # Crear logs con diferentes usuarios
        AuditService.log_stock_change(
            inventory_id=self.inventory.id,
            action='increment',
            quantity_before=Decimal('100.0'),
            quantity_after=Decimal('150.0'),
            source='invoice',
            user=self.user,
        )
        
        AuditService.log_stock_change(
            inventory_id=self.inventory.id,
            action='increment',
            quantity_before=Decimal('100.0'),
            quantity_after=Decimal('150.0'),
            source='invoice',
            user=other_user,
        )
        
        result = AuditService.query_audit_logs(user_id=self.user.id, limit=10, offset=0)
        
        self.assertEqual(result['count'], 1)
        self.assertEqual(result['results'][0]['user'], 'testuser')
