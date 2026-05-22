import api from './api'

export const getSMTPConfig = () =>
  api.get('/empresa/smtp/')

export const saveSMTPConfig = (data) =>
  api.post('/empresa/smtp/', data)

export const updateSMTPConfig = (data) =>
  api.put('/empresa/smtp/', data)

export const patchSMTPConfig = (data) =>
  api.patch('/empresa/smtp/', data)

export const deleteSMTPConfig = () =>
  api.delete('/empresa/smtp/')

export const testSMTPConnection = (data) =>
  api.post('/empresa/smtp/test/', data)
