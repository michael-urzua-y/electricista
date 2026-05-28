from datetime import datetime, date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from expenses.models import Expense
from invoices.models import Invoice
from products.models import Provider
from quotes.models import Quote
from monaysolutions.module_access import MODULE_GROUP_PREFIX


User = get_user_model()


class TaxEstimatorAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='taxuser',
            email='tax@example.com',
            password='testpass123',
        )
        self.user.groups.add(
            Group.objects.create(name=f'{MODULE_GROUP_PREFIX}tax_estimator')
        )
        self.other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)
        self.provider = Provider.objects.create(name='Proveedor Test', rut='12345678-9')

    def test_estimator_uses_purchase_invoices_expenses_and_user_scope(self):
        Quote.objects.create(
            user=self.user,
            quote_number='Q-001',
            client_name='Cliente Test',
            status='approved',
            status_updated_at=timezone.make_aware(datetime(2026, 5, 15, 10, 0)),
            total=Decimal('200000'),
            tax_amount=Decimal('38000'),
            total_amount=Decimal('238000'),
        )
        Invoice.objects.create(
            user=self.user,
            provider=self.provider,
            invoice_number='F-001',
            issue_date=date(2026, 5, 20),
            received_date=date(2026, 5, 21),
            status='completed',
            subtotal_amount=Decimal('100000'),
            tax_amount=Decimal('19000'),
            total_amount=Decimal('119000'),
        )
        Expense.objects.create(
            created_by=self.user,
            date=date(2026, 5, 22),
            detail='Internet empresa',
            total_amount=Decimal('59500'),
            document_type='factura',
            is_company_invoice=True,
        )
        Expense.objects.create(
            created_by=self.user,
            date=date(2026, 5, 24),
            detail='Factura exenta',
            total_amount=Decimal('85196'),
            document_type='factura_exenta',
            is_company_invoice=True,
        )
        Expense.objects.create(
            created_by=self.other_user,
            date=date(2026, 5, 22),
            detail='No debe mezclarse',
            total_amount=Decimal('119000'),
            document_type='factura',
            is_company_invoice=True,
        )
        Expense.objects.create(
            created_by=self.user,
            date=date(2026, 5, 23),
            detail='Honorario profesional',
            total_amount=Decimal('1000000'),
            document_type='honorario',
        )

        response = self.client.get('/api/estimador-tributario/?year=2026&month=5')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['ventas_netas'], '200000.00')
        self.assertEqual(response.data['iva_debito'], '38000.00')
        self.assertEqual(response.data['compras_netas'], '235196.00')
        self.assertEqual(response.data['iva_credito'], '28500.00')
        self.assertEqual(response.data['compras_count'], 3)
        self.assertEqual(response.data['compras_giro_count'], 2)
        self.assertEqual(response.data['compras_giro_iva'], '28500.00')
        self.assertEqual(response.data['facturas_compra_count'], 1)
        self.assertEqual(response.data['gastos_factura_count'], 1)
        self.assertEqual(response.data['compras_exentas_count'], 1)
        self.assertEqual(response.data['compras_exentas_netas'], '85196.00')
        self.assertEqual(response.data['resultado_iva'], '9500.00')
        self.assertEqual(response.data['ppm'], '2000.00')
        self.assertEqual(response.data['retencion_honorarios_rate'], '0.1525')
        self.assertEqual(response.data['retencion_2da_categoria'], '152500.00')
        self.assertEqual(response.data['total_impuesto'], '164000.00')
        self.assertEqual(response.data['honorarios_renta_at'], '0.00')

    def test_purchase_invoice_counts_by_received_date_not_issue_date(self):
        Invoice.objects.create(
            user=self.user,
            provider=self.provider,
            invoice_number='F-002',
            issue_date=date(2026, 5, 31),
            received_date=date(2026, 6, 2),
            status='completed',
            subtotal_amount=Decimal('100000'),
            tax_amount=Decimal('19000'),
            total_amount=Decimal('119000'),
        )

        may_response = self.client.get('/api/estimador-tributario/?year=2026&month=5')
        june_response = self.client.get('/api/estimador-tributario/?year=2026&month=6')

        self.assertEqual(may_response.status_code, 200)
        self.assertEqual(june_response.status_code, 200)
        self.assertEqual(may_response.data['facturas_compra_count'], 0)
        self.assertEqual(june_response.data['facturas_compra_count'], 1)
        self.assertEqual(june_response.data['iva_credito'], '19000.00')

    def test_april_2026_includes_renta_at_fee_in_transfer_total(self):
        response = self.client.get('/api/estimador-tributario/?year=2026&month=4')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_impuesto'], '0.00')
        self.assertEqual(response.data['honorarios_contador'], '127500.00')
        self.assertEqual(response.data['honorarios_renta_at'], '300000.00')
        self.assertEqual(response.data['honorarios_renta_at_label'], 'HON RENTA AT 2026')
        self.assertEqual(response.data['total_a_transferir'], '427500.00')
