from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CompanyProfileView, QuoteViewSet, ProductCatalogView, ProductByProviderSearchView

router = DefaultRouter()
router.register(r'cotizaciones', QuoteViewSet, basename='quote')

urlpatterns = [
    path('empresa/perfil/', CompanyProfileView.as_view(), name='company-profile'),
    path('cotizaciones/productos/', ProductCatalogView.as_view(), name='product-catalog'),
    path('cotizaciones/buscar-por-proveedor/', ProductByProviderSearchView.as_view(), name='product-by-provider'),
    path('', include(router.urls)),
]
