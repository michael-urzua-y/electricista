import api from './api'

export const getLibroCompras = (year, month, page = 1) =>
  api.get('/accounting/libro-compras/', { params: { year, month, page } })

export const exportLibroCompras = (year, month) =>
  api.get('/accounting/libro-compras/export/', {
    params: { year, month },
    responseType: 'blob',
  })

export const getLibroVentas = (year, month, page = 1) =>
  api.get('/accounting/libro-ventas/', { params: { year, month, page } })

export const exportLibroVentas = (year, month) =>
  api.get('/accounting/libro-ventas/export/', {
    params: { year, month },
    responseType: 'blob',
  })

export const getResumenMensual = (year, month) =>
  api.get('/accounting/resumen/', { params: { year, month } })
