from django.contrib import admin
from .models import CompanyProfile, Quote, QuoteItem


@admin.register(CompanyProfile)
class CompanyProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'rut', 'email']


@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = ['quote_number', 'user', 'client_name', 'status', 'total_amount', 'created_at']
    list_filter = ['status']


@admin.register(QuoteItem)
class QuoteItemAdmin(admin.ModelAdmin):
    list_display = ['quote', 'product_name', 'quantity', 'unit', 'unit_price', 'line_total']
