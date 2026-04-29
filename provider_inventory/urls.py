"""
URLs para provider_inventory API.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProviderInventoryViewSet, AuditLogView

router = DefaultRouter()
router.register(r'provider-inventory', ProviderInventoryViewSet, basename='provider-inventory')

urlpatterns = [
    path('', include(router.urls)),
    path('audit-logs/', AuditLogView.as_view(), name='audit-logs'),
]
