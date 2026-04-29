from django.contrib import admin
from .models import ProviderInventory, ProviderInventoryAuditLog


@admin.register(ProviderInventory)
class ProviderInventoryAdmin(admin.ModelAdmin):
    list_display = ['product_name', 'provider', 'stock_quantity', 'unit_price', 'last_updated']
    list_filter = ['provider', 'unit_measure', 'last_updated']
    search_fields = ['product_name', 'provider__name']
    readonly_fields = ['created_at', 'last_updated']


@admin.register(ProviderInventoryAuditLog)
class ProviderInventoryAuditLogAdmin(admin.ModelAdmin):
    list_display = ['inventory', 'action', 'quantity_changed', 'source', 'timestamp']
    list_filter = ['action', 'source', 'timestamp']
    search_fields = ['inventory__product_name', 'user__username']
    readonly_fields = ['timestamp', 'inventory', 'action', 'quantity_before',
                       'quantity_after', 'quantity_changed', 'source']

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False
