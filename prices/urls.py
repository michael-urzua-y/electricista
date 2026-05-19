"""
URLs para el módulo de precios.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PriceItemViewSet, PriceSubItemViewSet

router = DefaultRouter()
router.register(r'items', PriceItemViewSet, basename='price-item')
router.register(r'subitems', PriceSubItemViewSet, basename='price-subitem')

urlpatterns = [
    path('prices/', include(router.urls)),
]
