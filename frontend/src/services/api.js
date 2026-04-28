import axios from 'axios'

// Usar variable de entorno o fallback a /api para el proxy de desarrollo
const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor para agregar token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Si es 401 y no hemos reintentado aún, intentar renovar el token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (!refreshToken) throw new Error('No refresh token')

        const res = await axios.post(`${API_URL}/token/refresh/`, { refresh: refreshToken })
        const newAccess = res.data.access

        localStorage.setItem('token', newAccess)
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`
        originalRequest.headers['Authorization'] = `Bearer ${newAccess}`

        return api(originalRequest)
      } catch (refreshError) {
        // Refresh falló — limpiar sesión y redirigir
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
