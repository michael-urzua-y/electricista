import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import api from '../services/api'

// Usar variable de entorno o fallback a /api para el proxy
const API_URL = import.meta.env.VITE_API_URL || '/api'

const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)

const DEFAULT_MODULE_ORDER = [
  'quotes',
  'prices',
  'invoices',
  'expenses',
  'workers',
  'tax_estimator',
  'clients',
  'accounting',
  'products',
]

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setLoading(true)
      fetchUser()
    } else {
      setUser(null)
      setLoading(false)
    }
  }, [token])

  const fetchUser = async () => {
    try {
      const res = await api.get('/users/me/', { timeout: 10000 })
      setUser(res.data)
      const currentToken = localStorage.getItem('token')
      if (currentToken && currentToken !== token) {
        setToken(currentToken)
      }
    } catch (err) {
      console.error('Error fetching user:', err)
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
      localStorage.removeItem('refreshToken')
      delete axios.defaults.headers.common['Authorization']
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    const res = await axios.post(`${API_URL}/token/`, { username, password })
    const { access, refresh } = res.data
    localStorage.setItem('token', access)
    localStorage.setItem('refreshToken', refresh)
    setToken(access)
    axios.defaults.headers.common['Authorization'] = `Bearer ${access}`
    return res.data
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    setToken(null)
    setUser(null)
    delete axios.defaults.headers.common['Authorization']
  }

  const register = async (userData) => {
    const res = await axios.post(`${API_URL}/auth/register/`, userData)
    return res.data
  }

  const allowedModuleKeys = user?.allowed_modules?.map((module) => module.key) || []
  const hasModule = (moduleKey) => {
    if (!moduleKey) return true
    if (moduleKey === 'profile') return true
    if (user?.is_staff) return true
    return allowedModuleKeys.includes(moduleKey)
  }

  const defaultPath = (() => {
    if (!user) return '/'
    if (hasModule('quotes')) return '/'

    const firstModule = DEFAULT_MODULE_ORDER.find((moduleKey) => hasModule(moduleKey))
    const moduleConfig = user.allowed_modules?.find((module) => module.key === firstModule)
    return moduleConfig?.path || '/perfil'
  })()

  const value = {
    token,
    user,
    loading,
    login,
    logout,
    register,
    isAuthenticated: !!token,
    allowedModuleKeys,
    hasModule,
    defaultPath,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
