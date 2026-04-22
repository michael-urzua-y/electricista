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
    const access = res.data.access
    localStorage.setItem('token', access)
    setToken(access)  // <-- actualizar estado
    axios.defaults.headers.common['Authorization'] = `Bearer ${access}`
    // fetchUser() será llamado automáticamente por el useEffect que escucha [token]
    return res.data
  }

  const logout = () => {
    localStorage.removeItem('token')
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
