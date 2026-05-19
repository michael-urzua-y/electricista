import api from './api'

// --- Ítems (categorías) ---
export const getPriceItems = () =>
  api.get('/prices/items/')

export const getPriceItem = (id) =>
  api.get(`/prices/items/${id}/`)

export const createPriceItem = (data) =>
  api.post('/prices/items/', data)

export const updatePriceItem = (id, data) =>
  api.put(`/prices/items/${id}/`, data)

export const deletePriceItem = (id) =>
  api.delete(`/prices/items/${id}/`)

// --- Sub-Ítems ---
export const getSubItems = (itemId) =>
  api.get(`/prices/items/${itemId}/subitems/`)

export const createSubItem = (itemId, data) =>
  api.post(`/prices/items/${itemId}/subitems/`, data)

export const updateSubItem = (id, data) =>
  api.put(`/prices/subitems/${id}/`, data)

export const deleteSubItem = (id) =>
  api.delete(`/prices/subitems/${id}/`)

// --- Búsqueda de Sub-Ítems (para cotizaciones) ---
export const searchSubItems = (searchText) =>
  api.get('/prices/subitems/', { params: { search: searchText } })
