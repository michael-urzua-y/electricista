from decimal import Decimal
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Worker


class WorkerPayrollCalculationTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='payroll@example.com',
            email='payroll@example.com',
            password='testpass123',
        )
        cache.clear()

    def test_isapre_uf_plan_calculates_additional_health_from_liquidation(self):
        worker = Worker.objects.create(
            user=self.user,
            name='Michael Urzua',
            gross_salary=Decimal('1403599'),
            gratification=Decimal('213354'),
            meal_allowance=Decimal('100000'),
            transport_allowance=Decimal('50000'),
            other_allowance=Decimal('50000'),
            afp_rate=Decimal('10.46'),
            health_rate=Decimal('7.00'),
            unemployment_rate=Decimal('0.60'),
            health_system=Worker.HEALTH_SYSTEM_ISAPRE,
            health_plan_unit=Worker.HEALTH_PLAN_UF,
            health_plan_uf=Decimal('3.1840'),
            health_uf_value=Decimal('39841.72'),
        )

        self.assertEqual(worker.taxable_base, Decimal('1616953'))
        self.assertEqual(worker.afp_amount, Decimal('169133'))
        self.assertEqual(worker.health_legal_amount, Decimal('113187'))
        self.assertEqual(worker.health_plan_amount, Decimal('126856'))
        self.assertEqual(worker.health_additional_amount, Decimal('13669'))
        self.assertEqual(worker.health_total_amount, Decimal('126856'))
        self.assertEqual(worker.unemployment_amount, Decimal('9702'))
        self.assertEqual(worker.deductions_amount, Decimal('305691'))
        self.assertEqual(worker.taxable_income, Decimal('1311262'))
        self.assertEqual(worker.total_earnings, Decimal('1816953'))

    def test_fonasa_ignores_stored_additional_health(self):
        worker = Worker.objects.create(
            user=self.user,
            name='Worker Fonasa',
            gross_salary=Decimal('1000000'),
            additional_health=Decimal('25000'),
            health_system=Worker.HEALTH_SYSTEM_FONASA,
        )

        self.assertEqual(worker.health_additional_amount, Decimal('0'))
        self.assertEqual(worker.health_total_amount, Decimal('70000'))

    @patch('workers.views.requests.get')
    def test_uf_endpoint_returns_daily_value(self, mock_get):
        response = Mock()
        response.json.return_value = {
            'uf': {
                'valor': 40543.07,
                'fecha': '2026-05-27T04:00:00.000Z',
            }
        }
        response.raise_for_status.return_value = None
        mock_get.return_value = response

        client = APIClient()
        client.force_authenticate(user=self.user)
        res = client.get('/api/trabajadores/valor-uf/')

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['value'], '40543.07')
        self.assertEqual(res.data['source'], 'mindicador.cl')
