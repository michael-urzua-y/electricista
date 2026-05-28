from django.contrib import admin
from .models import Worker


@admin.register(Worker)
class WorkerAdmin(admin.ModelAdmin):
    list_display = [
        'name',
        'rut',
        'position',
        'gross_salary',
        'health_system',
        'health_plan_unit',
        'is_active',
    ]
    list_filter = ['is_active', 'health_system', 'health_plan_unit', 'user']
    search_fields = ['name', 'rut', 'position']
