from django.contrib import admin
from .models import PriceItem, PriceSubItem


class PriceSubItemInline(admin.TabularInline):
    model = PriceSubItem
    extra = 1


@admin.register(PriceItem)
class PriceItemAdmin(admin.ModelAdmin):
    list_display = ['order_number', 'name', 'user', 'created_at']
    list_filter = ['user']
    search_fields = ['name']
    inlines = [PriceSubItemInline]


@admin.register(PriceSubItem)
class PriceSubItemAdmin(admin.ModelAdmin):
    list_display = ['full_number', 'description', 'net_value', 'item']
    list_filter = ['item']
    search_fields = ['description']
