import api from './api'

export const getWorkers = () =>
  api.get('/trabajadores/')

export const getUfValue = () =>
  api.get('/trabajadores/valor-uf/')

export const getWorker = (id) =>
  api.get(`/trabajadores/${id}/`)

export const createWorker = (data) =>
  api.post('/trabajadores/', data)

export const updateWorker = (id, data) =>
  api.put(`/trabajadores/${id}/`, data)

export const deleteWorker = (id) =>
  api.delete(`/trabajadores/${id}/`)
