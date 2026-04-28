import { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'

// Usar variable de entorno o fallback a /api para el proxy
const API_URL = import.meta.env.VITE_API_URL || '/api'

const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [token])

  const fetchUser = async () => {
    try {
      const res = await axios.get(`${API_URL}/users/me/`)
      setUser(res.data)
    } catch (err) {
      console.error('Error fetching user:', err)
      localStorage.removeItem('token')
      setToken(null)
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

  const value = {
    token,
    user,
    loading,
    login,
    logout,
    register,
    isAuthenticated: !!token
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
