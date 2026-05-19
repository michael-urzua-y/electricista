import api from './api'

export const getEstimadorTributario = () =>
  api.get('/estimador-tributario/')
