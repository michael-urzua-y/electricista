import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background image with overlay */}
      <img
        src="/fondo.jpeg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-left"
        loading="eager"
        decoding="async"
      />
      <div className="absolute inset-0 bg-gray-900/60" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Login card - Diseño limpio y profesional */}
        <div className="bg-white/98 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden">
          {/* Header con logo */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-12 flex flex-col items-center justify-center">
            <img 
              src="/monayelectric-logo.png" 
              alt="Monayelectric" 
              className="w-20 h-20 drop-shadow-lg mb-4"
            />
            <h1 className="text-2xl font-bold text-white">Monayelectric</h1>
            <p className="text-primary-100 text-sm mt-1">Gestión de materiales</p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Iniciar sesión</h2>

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Usuario
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all bg-white text-gray-900"
                  placeholder="demo"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all pr-12 bg-white text-gray-900"
                    placeholder="demo123"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold py-2.5 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Iniciando sesión...
                  </span>
                ) : 'Iniciar sesión'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
              <p>Demo: <span className="font-medium text-gray-700">demo</span> / <span className="font-medium text-gray-700">demo123</span></p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-300 mt-6">© 2026 Monayelectric</p>
      </div>
    </div>
  )
}
