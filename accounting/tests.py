"""
Tests para el módulo contable.
"""
from decimal import Decimal
from datetime import date, datetime
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from invoices.models import Invoice
from quotes.models import Quote
from products.models import Provider

User = get_user_model()


class AccountingAPITestCase(TestCase):
    """Tests para los endpoints de contabilidad."""
    
    def setUp(self):
        """Configuración inicial para los tests."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        # Crear proveedor para facturas
        self.provider = Provider.objects.create(
            name='Proveedor Test',
            rut='12345678-9',
        )
    
    def test_libro_compras_requires_auth(self):
        """Verifica que el endpoint requiere autenticación."""
        client = APIClient()
        response = client.get('/api/accounting/libro-compras/?year=2024&month=12')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_libro_compras_requires_params(self):
        """Verifica que se requieren los parámetros year y month."""
        response = self.client.get('/api/accounting/libro-compras/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('year y month son requeridos', response.data['detail'])
    
    def test_libro_compras_validates_month(self):
        """Verifica que el mes debe estar entre 1 y 12."""
        response = self.client.get('/api/accounting/libro-compras/?year=2024&month=13')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_libro_compras_empty(self):
        """Verifica que retorna lista vacía cuando no hay facturas."""
        response = self.client.get('/api/accounting/libro-compras/?year=2024&month=12')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(len(response.data['results']), 0)
    
    def test_libro_compras_with_data(self):
        """Verifica que retorna facturas del período correcto."""
        # Crear factura en diciembre 2024
        Invoice.objects.create(
            user=self.user,
            provider=self.provider,
            invoice_number='F-001',
            issue_date=date(2024, 12, 15),
            status='completed',
            subtotal_amount=Decimal('100000'),
            tax_amount=Decimal('19000'),
            total_amount=Decimal('119000')
        )
        
        # Crear factura en noviembre 2024 (no debe aparecer)
        Invoice.objects.create(
            user=self.user,
            provider=self.provider,
            invoice_number='F-002',
            issue_date=date(2024, 11, 15),
            status='completed',
            subtotal_amount=Decimal('50000'),
            tax_amount=Decimal('9500'),
            total_amount=Decimal('59500')
        )
        
        response = self.client.get('/api/accounting/libro-compras/?year=2024&month=12')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(len(response.data['results']), 1)
        
        # Verificar datos
        item = response.data['results'][0]
        self.assertEqual(item['folio'], 'F-001')
        self.assertEqual(item['rut_proveedor'], '12345678-9')
        self.assertEqual(float(item['neto']), 100000.0)
        
        # Verificar totales
        totals = response.data['totals']
        self.assertEqual(float(totals['neto']), 100000.0)
        self.assertEqual(float(totals['iva']), 19000.0)
        self.assertEqual(float(totals['total']), 119000.0)
    
    def test_libro_ventas_requires_auth(self):
        """Verifica que el endpoint requiere autenticación."""
        client = APIClient()
        response = client.get('/api/accounting/libro-ventas/?year=2024&month=12')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_libro_ventas_with_approved_quotes(self):
        """Verifica que retorna solo cotizaciones aprobadas."""
        # Crear cotización aprobada
        Quote.objects.create(
            user=self.user,
            quote_number='Q-001',
            client_name='Cliente Test',
            client_rut='98765432-1',
            status='approved',
            status_updated_at=timezone.make_aware(datetime(2024, 12, 15, 12, 0)),
            subtotal=Decimal('200000'),
            tax_amount=Decimal('38000'),
            total_amount=Decimal('238000')
        )
        
        # Crear cotización draft (no debe aparecer)
        Quote.objects.create(
            user=self.user,
            quote_number='Q-002',
            client_name='Cliente Test 2',
            status='draft',
            subtotal=Decimal('100000'),
            tax_amount=Decimal('19000'),
            total_amount=Decimal('119000')
        )
        
        response = self.client.get('/api/accounting/libro-ventas/?year=2024&month=12')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Solo debe aparecer la cotización aprobada
        self.assertEqual(response.data['count'], 1)
    
    def test_resumen_mensual_requires_auth(self):
        """Verifica que el endpoint requiere autenticación."""
        client = APIClient()
        response = client.get('/api/accounting/resumen/?year=2024&month=12')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_resumen_mensual_structure(self):
        """Verifica la estructura del resumen mensual."""
        response = self.client.get('/api/accounting/resumen/?year=2024&month=12')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verificar campos requeridos
        required_fields = [
            'total_compras_netas', 'total_ventas_netas',
            'iva_soportado', 'iva_debito', 'resultado_iva',
            'iva_a_pagar', 'monto_iva'
        ]
        for field in required_fields:
            self.assertIn(field, response.data)
    
    def test_libro_compras_export_returns_excel(self):
        """Verifica que el endpoint de exportación retorna un archivo Excel."""
        response = self.client.get('/api/accounting/libro-compras/export/?year=2024&month=12')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        self.assertIn('attachment', response['Content-Disposition'])
        self.assertIn('libro_compras_2024_12.xlsx', response['Content-Disposition'])
    
    def test_libro_ventas_export_returns_excel(self):
        """Verifica que el endpoint de exportación retorna un archivo Excel."""
        response = self.client.get('/api/accounting/libro-ventas/export/?year=2024&month=12')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        self.assertIn('attachment', response['Content-Disposition'])
        self.assertIn('libro_ventas_2024_12.xlsx', response['Content-Disposition'])
