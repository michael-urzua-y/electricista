from django.contrib import admin
from .models import Client, ClientSettings


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'rut', 'name', 'email', 'phone', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['rut', 'name', 'email']
    raw_id_fields = ['user']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ClientSettings)
class ClientSettingsAdmin(admin.ModelAdmin):
    list_display = ['user', 'inactivity_days']
    raw_id_fields = ['user']
