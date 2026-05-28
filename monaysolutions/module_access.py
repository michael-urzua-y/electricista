from rest_framework.permissions import BasePermission


MODULE_GROUP_PREFIX = 'module:'

MAIN_MODULES = {
    'quotes': {
        'label': 'Cotizaciones',
        'path': '/',
    },
    'invoices': {
        'label': 'Compras',
        'path': '/facturas',
    },
    'expenses': {
        'label': 'Gastos Generales',
        'path': '/gastos-generales',
    },
    'prices': {
        'label': 'Precios',
        'path': '/precios',
    },
    'workers': {
        'label': 'Trabajadores',
        'path': '/trabajadores',
    },
    'tax_estimator': {
        'label': 'Estimador Tributario',
        'path': '/estimador-tributario',
    },
    'clients': {
        'label': 'Clientes',
        'path': '/clients',
    },
    'accounting': {
        'label': 'Contabilidad',
        'path': '/accounting',
    },
    'products': {
        'label': 'Productos e Inventario',
        'path': '/productos',
    },
}

ALWAYS_ALLOWED_MODULES = {'profile'}

MODULE_PATH_PREFIXES = (
    ('/api/prices/', 'prices'),
    ('/api/cotizaciones/', 'quotes'),
    ('/api/facturas/diarios/', 'invoices'),
    ('/api/facturas/', 'invoices'),
    ('/api/gastos/', 'expenses'),
    ('/api/trabajadores/', 'workers'),
    ('/api/estimador-tributario/', 'tax_estimator'),
    ('/api/clients/', 'clients'),
    ('/api/accounting/', 'accounting'),
    ('/api/proveedores/', 'products'),
    ('/api/productos/', 'products'),
    ('/api/comparacion/', 'products'),
    ('/api/provider-inventory/', 'products'),
    ('/api/audit-logs/', 'products'),
    ('/api/inventory/', 'products'),
    ('/api/dashboard/', 'quotes'),
    ('/api/empresa/', 'profile'),
)


def resolve_module_from_path(path):
    for prefix, module in MODULE_PATH_PREFIXES:
        if path.startswith(prefix):
            return module
    return None


def user_module_keys(user):
    if not user or not user.is_authenticated:
        return []
    if user.is_superuser or user.is_staff:
        return list(MAIN_MODULES.keys())

    group_names = user.groups.values_list('name', flat=True)
    modules = set()
    for group_name in group_names:
        if not group_name.startswith(MODULE_GROUP_PREFIX):
            continue
        module = group_name.removeprefix(MODULE_GROUP_PREFIX)
        if module == 'all':
            return list(MAIN_MODULES.keys())
        if module in MAIN_MODULES:
            modules.add(module)

    return [module for module in MAIN_MODULES if module in modules]


def user_can_access_module(user, module):
    if module is None or module in ALWAYS_ALLOWED_MODULES:
        return True
    return module in user_module_keys(user)


def module_payload_for_user(user):
    allowed = user_module_keys(user)
    return [
        {
            'key': key,
            'label': MAIN_MODULES[key]['label'],
            'path': MAIN_MODULES[key]['path'],
        }
        for key in allowed
    ]


class HasModuleAccess(BasePermission):
    message = 'No tienes acceso a este módulo.'

    def has_permission(self, request, view):
        module = resolve_module_from_path(request.path)
        return user_can_access_module(request.user, module)
