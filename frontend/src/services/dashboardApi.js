import api from './api'

export const getDashboardKpis = (year, month) =>
  api.get('/dashboard/kpis/', { params: { year, month } })
