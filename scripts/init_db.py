#!/usr/bin/env python
import sys
import os

# Asegurar que el directorio raíz del proyecto esté en el path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electricista.settings')

import django
django.setup()

from django.contrib.auth import get_user_model
from products.models import Provider

User = get_user_model()

# Crear superusuario demo
if not User.objects.filter(username='demo').exists():
    User.objects.create_superuser('demo', 'demo@example.com', 'demo123')
    print("✅ Usuario demo creado: demo / demo123")
else:
    print("ℹ️ Usuario demo ya existe")

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
