"""
URLs para provider_inventory API.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ProviderInventoryViewSet,
    AuditLogView,
    LowStockListView,
    LowStockCountView,
)

router = DefaultRouter()
router.register(r'provider-inventory', ProviderInventoryViewSet, basename='provider-inventory')

urlpatterns = [
    path('', include(router.urls)),
    path('audit-logs/', AuditLogView.as_view(), name='audit-logs'),
    path('inventory/low-stock/', LowStockListView.as_view(), name='low-stock-list'),
    path('inventory/low-stock/count/', LowStockCountView.as_view(), name='low-stock-count'),
]
