"""
URLs para el módulo contable.
"""
from django.urls import path
from . import views

urlpatterns = [
    # Libro de compras
    path('accounting/libro-compras/', views.libro_compras_view, name='libro-compras'),
    path('accounting/libro-compras/export/', views.libro_compras_export_view, name='libro-compras-export'),
    
    # Libro de ventas
    path('accounting/libro-ventas/', views.libro_ventas_view, name='libro-ventas'),
    path('accounting/libro-ventas/export/', views.libro_ventas_export_view, name='libro-ventas-export'),
    
    # Resumen mensual
    path('accounting/resumen/', views.resumen_mensual_view, name='resumen-mensual'),
]
