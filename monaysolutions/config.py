import os
from decimal import Decimal


def env_decimal(name, default):
    return Decimal(str(os.getenv(name, default)))


def env_int(name, default):
    return int(os.getenv(name, default))


def env_rate_map(name, default):
    raw = os.getenv(name, default)
    rates = {}
    for pair in raw.split(','):
        if not pair.strip() or ':' not in pair:
            continue
        year, rate = pair.split(':', 1)
        rates[int(year.strip())] = Decimal(rate.strip())
    return rates


IVA_RATE = env_decimal('IVA_RATE', '0.19')
PPM_RATE = env_decimal('PPM_RATE', '0.01')
TWO_PLACES = Decimal('0.01')

TAX_CUTOFF_WITHOUT_GUIDE_DAY = env_int('TAX_CUTOFF_WITHOUT_GUIDE_DAY', 5)
TAX_CUTOFF_WITH_GUIDE_DAY = env_int('TAX_CUTOFF_WITH_GUIDE_DAY', 10)
TAX_ESTIMATOR_ACCOUNTANT_FEE = env_decimal('TAX_ESTIMATOR_ACCOUNTANT_FEE', '127500')
TAX_ESTIMATOR_RENTA_AT_YEAR = env_int('TAX_ESTIMATOR_RENTA_AT_YEAR', 2026)
TAX_ESTIMATOR_RENTA_AT_MONTH = env_int('TAX_ESTIMATOR_RENTA_AT_MONTH', 4)
TAX_ESTIMATOR_RENTA_AT_AMOUNT = env_decimal('TAX_ESTIMATOR_RENTA_AT_AMOUNT', '300000')
HONORARIOS_RETENTION_RATES = env_rate_map(
    'HONORARIOS_RETENTION_RATES',
    '2024:0.1375,2025:0.1450,2026:0.1525,2027:0.1600',
)

WORKER_UTM_VALUE = env_decimal('WORKER_UTM_VALUE', '67294')
WORKER_HEALTH_RATE = env_decimal('WORKER_HEALTH_RATE', '7.00')
WORKER_UNEMPLOYMENT_RATE = env_decimal('WORKER_UNEMPLOYMENT_RATE', '0.60')

API_DEFAULT_PAGE_SIZE = env_int('API_DEFAULT_PAGE_SIZE', 10)
API_MAX_PAGE_SIZE = env_int('API_MAX_PAGE_SIZE', 100)
ACCOUNTING_PAGE_SIZE = env_int('ACCOUNTING_PAGE_SIZE', 50)
LOW_STOCK_PAGE_SIZE = env_int('LOW_STOCK_PAGE_SIZE', 50)

MAX_COMPANY_LOGO_MB = env_int('MAX_COMPANY_LOGO_MB', 2)
MAX_INVOICE_UPLOAD_MB = env_int('MAX_INVOICE_UPLOAD_MB', 10)
MAX_EXPENSE_UPLOAD_MB = env_int('MAX_EXPENSE_UPLOAD_MB', 10)
