from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkerViewSet

router = DefaultRouter()
router.register(r'trabajadores', WorkerViewSet, basename='trabajador')

urlpatterns = [
    path('', include(router.urls)),
]
