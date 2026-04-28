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
      <div className="absolute inset-0 bg-black/60" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Login card - Diseño profesional con mejor contraste */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header con fondo oscuro */}
          <div className="bg-gray-900 px-8 py-14 flex flex-col items-center justify-center border-b-4 border-yellow-500">
            <img 
              src="/monayelectric-logo.png" 
              alt="Monayelectric" 
              className="w-20 h-20 drop-shadow-lg mb-4"
            />
            <h1 className="text-2xl font-bold text-white">Monayelectric</h1>
            <p className="text-gray-400 text-sm mt-1 tracking-wide uppercase">Gestión de materiales</p>
          </div>

          {/* Form */}
          <div className="px-8 py-10">

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-gray-800 mb-2">
                  Usuario
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-500 outline-none transition-all bg-white text-gray-900 font-medium"
                  placeholder="demo"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-800 mb-2">
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
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-500 outline-none transition-all pr-12 bg-white text-gray-900 font-medium"
                    placeholder="demo123"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
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

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-gray-900 font-bold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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
              </div>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">© 2026 Monayelectric</p>
      </div>
    </div>
  )
}
