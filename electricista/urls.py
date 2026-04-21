from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from products.views import ProviderViewSet, ProductViewSet, ComparacionViewSet
from invoices.views import FacturaViewSet
from api_views import CurrentUserView, DailyTotalsView

router = DefaultRouter()
router.register(r'proveedores', ProviderViewSet, basename='proveedor')
router.register(r'productos', ProductViewSet, basename='producto')
router.register(r'comparacion', ComparacionViewSet, basename='comparacion')
router.register(r'facturas', FacturaViewSet, basename='factura')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/facturas/diarios/', DailyTotalsView.as_view(), name='daily-totals'),
    path('api/', include(router.urls)),
    path('api/users/me/', CurrentUserView.as_view(), name='current_user'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)