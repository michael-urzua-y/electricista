#!/usr/bin/env python
import sys
import os

# Asegurar que el directorio raíz del proyecto esté en el path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'monaysolutions.settings')

import django
django.setup()

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from products.models import Provider
from monaysolutions.module_access import MAIN_MODULES, MODULE_GROUP_PREFIX

User = get_user_model()

# Leer contraseña del usuario demo desde env var
demo_password = os.getenv('DEMO_PASSWORD', 'demo123')
test_password = os.getenv('TEST_PASSWORD', 'test123')

# Crear grupos de acceso por módulo
module_groups = {}
for module_key, module_config in MAIN_MODULES.items():
    group, created = Group.objects.get_or_create(name=f'{MODULE_GROUP_PREFIX}{module_key}')
    module_groups[module_key] = group
    if created:
        print(f"✅ Grupo de módulo creado: {module_config['label']}")

# Crear superusuario demo
if not User.objects.filter(username='demo').exists():
    User.objects.create_superuser('demo', 'demo@example.com', demo_password)
    print(f"✅ Usuario demo creado: demo / {demo_password}")
else:
    print("ℹ️ Usuario demo ya existe")

# Usuario de prueba de cliente con acceso solo al módulo Precios
test_user, test_created = User.objects.get_or_create(
    username='test',
    defaults={
        'email': 'test@example.com',
        'is_staff': False,
        'is_superuser': False,
        'is_active': True,
    },
)
if test_created:
    test_user.set_password(test_password)
    test_user.save()
    print(f"✅ Usuario test creado: test / {test_password}")
else:
    test_user.set_password(test_password)
    test_user.is_staff = False
    test_user.is_superuser = False
    test_user.is_active = True
    test_user.save(update_fields=['password', 'is_staff', 'is_superuser', 'is_active'])
    print("ℹ️ Usuario test ya existe")

test_user.groups.remove(*[
    group for group in test_user.groups.all()
    if group.name.startswith(MODULE_GROUP_PREFIX)
])
test_user.groups.add(module_groups['prices'])

# Crear proveedores iniciales
providers = [
    'Sodimac',
    'Easy',
    'Homecenter',
    'Dimak',
    'Construmart',
]

for name in providers:
    obj, created = Provider.objects.get_or_create(
        name=name,
        defaults={'category': 'construccion', 'is_active': True}
    )
    if created:
        print(f"✅ Proveedor creado: {name}")
    else:
        print(f"ℹ️ Proveedor ya existía: {name}")

print("\n✨ Inicialización completada!")
print("Puedes acceder al admin en: http://localhost:8000/admin/")
