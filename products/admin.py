from django.contrib import admin
from .models import Provider, Product, PriceHistory


@admin.register(Provider)
class ProviderAdmin(admin.ModelAdmin):
    list_display = ['name', 'website', 'category', 'is_active', 'created_at']
    list_filter = ['category', 'is_active']
    search_fields = ['name', 'website']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'brand', 'provider', 'category', 'is_active', 'updated_at']
    list_filter = ['category', 'provider', 'is_active']
    search_fields = ['name', 'brand', 'model']
    raw_id_fields = ['provider']


@admin.register(PriceHistory)
class PriceHistoryAdmin(admin.ModelAdmin):
    list_display = ['product', 'provider', 'price', 'currency', 'recorded_at']
    list_filter = ['provider', 'currency', 'recorded_at']
    search_fields = ['product__name']
    raw_id_fields = ['product', 'provider']
