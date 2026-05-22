from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CompanyProfileView, CompanyLogoView, SMTPConfigView, SMTPTestView, QuoteViewSet

router = DefaultRouter()
router.register(r'cotizaciones', QuoteViewSet, basename='quote')

urlpatterns = [
    path('empresa/perfil/', CompanyProfileView.as_view(), name='company-profile'),
    path('empresa/perfil/logo/', CompanyLogoView.as_view(), name='company-logo'),
    path('empresa/smtp/', SMTPConfigView.as_view(), name='smtp-config'),
    path('empresa/smtp/test/', SMTPTestView.as_view(), name='smtp-test'),
    path('', include(router.urls)),
]
