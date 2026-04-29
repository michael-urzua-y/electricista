"""
Admin configuration para provider_inventory.
"""
from django.contrib import admin
from .models import (
    ProviderInventory,
    ProviderInventoryAuditLog,
    StockReservation,
    ProviderInventoryPriceHistory,
)


@admin.register(ProviderInventory)
class ProviderInventoryAdmin(admin.ModelAdmin):
    list_display = ['product_name', 'provider', 'stock_quantity', 'unit_price', 'last_updated']
    list_filter = ['provider', 'unit_measure', 'last_updated']
    search_fields = ['product_name', 'provider__name']
    readonly_fields = ['created_at', 'last_updated']
    
    fieldsets = (
        ('Información del Producto', {
            'fields': ('product_name', 'provider', 'unit_measure')
        }),
        ('Stock y Precio', {
            'fields': ('stock_quantity', 'unit_price')
        }),
        ('Metadata', {
            'fields': ('last_invoice_id', 'created_at', 'last_updated')
        }),
    )


@admin.register(ProviderInventoryAuditLog)
class ProviderInventoryAuditLogAdmin(admin.ModelAdmin):
    list_display = ['inventory', 'action', 'quantity_changed', 'source', 'timestamp']
    list_filter = ['action', 'source', 'timestamp']
    search_fields = ['inventory__product_name', 'user__username']
    readonly_fields = ['timestamp', 'inventory', 'action', 'quantity_before', 'quantity_after', 'quantity_changed', 'source']
    
    def has_add_permission(self, request):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False


@admin.register(StockReservation)
class StockReservationAdmin(admin.ModelAdmin):
    list_display = ['quote', 'inventory', 'quantity_reserved', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['quote__quote_number', 'inventory__product_name']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Cotización', {
            'fields': ('quote', 'quote_item')
        }),
        ('Inventario', {
            'fields': ('inventory', 'quantity_reserved')
        }),
        ('Estado', {
            'fields': ('status',)
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(ProviderInventoryPriceHistory)
class ProviderInventoryPriceHistoryAdmin(admin.ModelAdmin):
    list_display = ['inventory', 'unit_price', 'source', 'recorded_at']
    list_filter = ['source', 'recorded_at']
    search_fields = ['inventory__product_name']
    readonly_fields = ['recorded_at']
    
    fieldsets = (
        ('Inventario', {
            'fields': ('inventory',)
        }),
        ('Precio', {
            'fields': ('unit_price', 'source')
        }),
        ('Referencia', {
            'fields': ('invoice_id',)
        }),
        ('Metadata', {
            'fields': ('recorded_at',)
        }),
    )
