"""
Vistas para el módulo contable.
"""
from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from .services import get_libro_compras, get_libro_ventas, get_resumen_mensual, export_to_excel
from monaysolutions.config import ACCOUNTING_PAGE_SIZE, API_MAX_PAGE_SIZE
from monaysolutions.module_access import HasModuleAccess


class AccountingPagination(PageNumberPagination):
    """Paginación de 50 registros por página para libros contables."""
    page_size = ACCOUNTING_PAGE_SIZE
    page_size_query_param = 'page_size'
    max_page_size = API_MAX_PAGE_SIZE


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasModuleAccess])
def libro_compras_view(request):
    """
    GET /api/accounting/libro-compras/?year=2024&month=12
    
    Retorna el libro de compras mensual con paginación de 50 registros.
    """
    # Validar parámetros
    year = request.query_params.get('year')
    month = request.query_params.get('month')
    
    if not year or not month:
        return Response(
            {'detail': 'Los parámetros year y month son requeridos.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        year = int(year)
        month = int(month)
        if not (1 <= month <= 12):
            raise ValueError('El mes debe estar entre 1 y 12.')
    except ValueError as e:
        return Response(
            {'detail': f'Parámetros inválidos: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Obtener datos
    libro = get_libro_compras(request.user, year, month)
    
    # Aplicar paginación
    paginator = AccountingPagination()
    paginated_libro = paginator.paginate_queryset(libro, request)

    # Calcular totales sobre el libro completo
    total_neto = sum(item['neto'] for item in libro)
    total_iva = sum(item['iva'] for item in libro)
    total_bruto = sum(item['total'] for item in libro)

    # Retornar respuesta paginada con totales en headers
    response = paginator.get_paginated_response(paginated_libro)
    response.data['totals'] = {
        'neto': total_neto,
        'iva': total_iva,
        'total': total_bruto,
    }
    return response


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasModuleAccess])
def libro_compras_export_view(request):
    """
    GET /api/accounting/libro-compras/export/?year=2024&month=12
    
    Descarga el libro de compras como archivo Excel (.xlsx).
    """
    # Validar parámetros
    year = request.query_params.get('year')
    month = request.query_params.get('month')
    
    if not year or not month:
        return Response(
            {'detail': 'Los parámetros year y month son requeridos.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        year = int(year)
        month = int(month)
        if not (1 <= month <= 12):
            raise ValueError('El mes debe estar entre 1 y 12.')
    except ValueError as e:
        return Response(
            {'detail': f'Parámetros inválidos: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Obtener datos
    libro = get_libro_compras(request.user, year, month)
    
    # Definir columnas en orden SII
    columns = ['rut_proveedor', 'razon_social', 'folio', 'fecha', 'neto', 'iva', 'total']
    
    # Generar Excel
    excel_bytes = export_to_excel(libro, columns, sheet_name='Libro de Compras')
    
    # Crear respuesta HTTP con archivo
    response = HttpResponse(
        excel_bytes,
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="libro_compras_{year}_{month:02d}.xlsx"'
    
    return response


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasModuleAccess])
def libro_ventas_view(request):
    """
    GET /api/accounting/libro-ventas/?year=2024&month=12
    
    Retorna el libro de ventas mensual con paginación de 50 registros.
    """
    # Validar parámetros
    year = request.query_params.get('year')
    month = request.query_params.get('month')
    
    if not year or not month:
        return Response(
            {'detail': 'Los parámetros year y month son requeridos.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        year = int(year)
        month = int(month)
        if not (1 <= month <= 12):
            raise ValueError('El mes debe estar entre 1 y 12.')
    except ValueError as e:
        return Response(
            {'detail': f'Parámetros inválidos: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Obtener datos
    libro = get_libro_ventas(request.user, year, month)
    
    # Aplicar paginación
    paginator = AccountingPagination()
    paginated_libro = paginator.paginate_queryset(libro, request)

    # Calcular totales sobre el libro completo
    total_neto = sum(item['neto'] for item in libro)
    total_iva = sum(item['iva'] for item in libro)
    total_bruto = sum(item['total'] for item in libro)

    response = paginator.get_paginated_response(paginated_libro)
    response.data['totals'] = {
        'neto': total_neto,
        'iva': total_iva,
        'total': total_bruto,
    }
    return response


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasModuleAccess])
def libro_ventas_export_view(request):
    """
    GET /api/accounting/libro-ventas/export/?year=2024&month=12
    
    Descarga el libro de ventas como archivo Excel (.xlsx).
    """
    # Validar parámetros
    year = request.query_params.get('year')
    month = request.query_params.get('month')
    
    if not year or not month:
        return Response(
            {'detail': 'Los parámetros year y month son requeridos.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        year = int(year)
        month = int(month)
        if not (1 <= month <= 12):
            raise ValueError('El mes debe estar entre 1 y 12.')
    except ValueError as e:
        return Response(
            {'detail': f'Parámetros inválidos: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Obtener datos
    libro = get_libro_ventas(request.user, year, month)
    
    # Definir columnas en orden SII
    columns = ['rut_cliente', 'nombre_cliente', 'folio', 'fecha', 'neto', 'iva', 'total']
    
    # Generar Excel
    excel_bytes = export_to_excel(libro, columns, sheet_name='Libro de Ventas')
    
    # Crear respuesta HTTP con archivo
    response = HttpResponse(
        excel_bytes,
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="libro_ventas_{year}_{month:02d}.xlsx"'
    
    return response


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasModuleAccess])
def resumen_mensual_view(request):
    """
    GET /api/accounting/resumen/?year=2024&month=12
    
    Retorna el resumen contable mensual consolidado con comparación del mes anterior.
    """
    # Validar parámetros
    year = request.query_params.get('year')
    month = request.query_params.get('month')
    
    if not year or not month:
        return Response(
            {'detail': 'Los parámetros year y month son requeridos.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        year = int(year)
        month = int(month)
        if not (1 <= month <= 12):
            raise ValueError('El mes debe estar entre 1 y 12.')
    except ValueError as e:
        return Response(
            {'detail': f'Parámetros inválidos: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Obtener resumen
    resumen = get_resumen_mensual(request.user, year, month)
    
    return Response(resumen)
