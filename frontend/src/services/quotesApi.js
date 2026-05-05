import api from './api'

export const getCompanyProfile = () =>
  api.get('/empresa/perfil/')

export const saveCompanyProfile = (data) => {
  // Si data es FormData (incluye logo binario), usar multipart
  if (data instanceof FormData) {
    return api.put('/empresa/perfil/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }
  return api.put('/empresa/perfil/', data)
}

export const patchCompanyProfile = (data) => {
  if (data instanceof FormData) {
    return api.patch('/empresa/perfil/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }
  return api.patch('/empresa/perfil/', data)
}

export const getProductCatalog = (search = '') =>
  api.get(`/cotizaciones/productos/${search ? `?search=${encodeURIComponent(search)}` : ''}`)

// Nueva búsqueda: retorna el mismo producto de múltiples proveedores
export const searchProductsByProvider = (search = '') =>
  api.get(`/cotizaciones/buscar-por-proveedor/?search=${encodeURIComponent(search)}`)

export const getQuotes = (status = '', page = 1) => {
  const params = new URLSearchParams()
  if (status) params.append('status', status)
  if (page > 1) params.append('page', page)
  const query = params.toString()
  return api.get(`/cotizaciones/${query ? `?${query}` : ''}`)
}

export const getQuote = (id) =>
  api.get(`/cotizaciones/${id}/`)

export const createQuote = (data) =>
  api.post('/cotizaciones/', data)

export const updateQuote = (id, data) =>
  api.patch(`/cotizaciones/${id}/`, data)

export const changeQuoteStatus = (id, status) =>
  api.post(`/cotizaciones/${id}/cambiar-estado/`, { status })

export const downloadQuotePdf = (id) =>
  api.get(`/cotizaciones/${id}/pdf/`, { responseType: 'blob' })
