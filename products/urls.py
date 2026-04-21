from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'proveedores', views.ProveedorViewSet)
router.register(r'productos', views.ProductoViewSet)
router.register(r'comparacion', views.ComparacionViewSet, basename='comparacion')

urlpatterns = [
    path('', include(router.urls)),
]
