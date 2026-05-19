import api from './api'

export const getExpenses = () =>
  api.get('/gastos/')

export const createExpense = (formData) =>
  api.post('/gastos/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const updateExpense = (id, formData) =>
  api.put(`/gastos/${id}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const deleteExpense = (id) =>
  api.delete(`/gastos/${id}/`)

export const getComprobante = (id) =>
  api.get(`/gastos/${id}/comprobante/`, {
    responseType: 'blob',
  })
