from django.contrib import admin
from .models import Invoice, InvoiceItem


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 0
    fields = ['description', 'quantity', 'unit_price', 'total_price', 'product', 'needs_review']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'provider', 'invoice_number', 'issue_date', 'total_amount', 'currency', 'status', 'created_at']
    list_filter = ['status', 'currency', 'issue_date', 'provider']
    search_fields = ['invoice_number', 'ocr_text']
    raw_id_fields = ['user', 'provider']
    inlines = [InvoiceItemInline]


@admin.register(InvoiceItem)
class InvoiceItemAdmin(admin.ModelAdmin):
    list_display = ['invoice', 'description', 'quantity', 'unit_price', 'total_price', 'product', 'needs_review']
    list_filter = ['needs_review']
    search_fields = ['description']
    raw_id_fields = ['invoice', 'product']
