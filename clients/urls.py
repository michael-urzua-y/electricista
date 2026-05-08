"""
URLs para el módulo de clientes.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, ClientSettingsView

router = DefaultRouter()
router.register(r'clients', ClientViewSet, basename='client')

urlpatterns = [
    path('clients/settings/', ClientSettingsView.as_view(), name='client-settings'),
    path('', include(router.urls)),
]
