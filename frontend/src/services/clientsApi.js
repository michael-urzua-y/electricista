import api from './api'

export const getClients = (params = {}) =>
  api.get('/clients/', { params })

export const getClient = (id) =>
  api.get(`/clients/${id}/`)

export const createClient = (data) =>
  api.post('/clients/', data)

export const updateClient = (id, data) =>
  api.patch(`/clients/${id}/`, data)

export const deactivateClient = (id) =>
  api.delete(`/clients/${id}/`)

export const getClientQuotes = (id) =>
  api.get(`/clients/${id}/quotes/`)

export const getClientStats = (id) =>
  api.get(`/clients/${id}/stats/`)

export const getInactiveClients = () =>
  api.get('/clients/inactive/')

export const getClientSettings = () =>
  api.get('/clients/settings/')

export const updateClientSettings = (data) =>
  api.patch('/clients/settings/', data)
