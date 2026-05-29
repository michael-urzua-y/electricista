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
    <div className="min-h-screen min-h-[100svh] relative overflow-hidden bg-gray-950">
      {/* Single background image covering entire screen */}
      <img
        src="/fondo.jpeg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover animate-slow-zoom"
        loading="eager"
        decoding="async"
      />
      {/* Animated particles overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="particle particle-1" />
        <div className="particle particle-2" />
        <div className="particle particle-3" />
        <div className="particle particle-4" />
        <div className="particle particle-5" />
        <div className="particle particle-6" />
        <div className="particle particle-7" />
        <div className="particle particle-8" />
      </div>
      {/* Color shift overlay: warm amber/yellow tint to match our palette */}
      <div className="absolute inset-0 bg-amber-900/25 lg:bg-amber-900/40" />
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950/95 via-gray-950/80 to-gray-950/95 lg:bg-gradient-to-r lg:from-gray-900/60 lg:via-transparent lg:to-gray-900/70" />

      {/* Content layer */}
      <div className="relative z-10 min-h-screen min-h-[100svh] flex flex-col lg:flex-row">

        {/* Left side - Landing text (3/4) */}
        <div className="hidden lg:flex lg:w-3/4 flex-col justify-between px-16 xl:px-24 py-12">
          {/* Logo top-left */}
          <div>
            <img src="/monay-solutions-logo.png" alt="Logo" className="h-40 w-auto drop-shadow-2xl" />
          </div>

          {/* Text content */}
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight drop-shadow-lg">
                Gestión
                <span className="text-yellow-400"> Inteligente.</span>
              </h1>
            </div>

            <div className="max-w-2xl space-y-4 text-gray-200 text-base leading-relaxed drop-shadow">
              <p>
                Cotiza más rápido, controla gastos, administra materiales y organiza toda tu documentación desde un solo lugar.
              </p>
              <p>
                Una plataforma diseñada para optimizar tu gestión operativa, ahorrar tiempo y aumentar tu productividad.
                Mantén control total de tu operación en tiempo real.
              </p>
            </div>
          </div>

          <div />
        </div>

        {/* Right side - Login panel (1/4, semi-transparent, full height) */}
        <div className="w-full lg:w-1/4 lg:min-w-[320px] flex flex-1 lg:flex-none flex-col bg-gray-950/80 lg:bg-gray-900/80 backdrop-blur-md">

          {/* Login content - centered vertically */}
          <div className="flex-1 flex flex-col justify-center w-full max-w-sm mx-auto px-6 py-8 sm:px-8 lg:max-w-none lg:px-8 lg:py-12 xl:px-10">
            <div className="lg:hidden mb-10 flex justify-center">
              <img src="/monay-solutions-logo.png" alt="Monay Solutions" className="h-28 w-auto drop-shadow-2xl" />
            </div>

            {/* Welcome */}
            <div className="mb-8">
              <h2 className="text-3xl lg:text-2xl font-bold text-white">Bienvenido</h2>
              <p className="text-gray-300 lg:text-gray-400 text-base lg:text-sm mt-2 lg:mt-1 leading-relaxed">Ingresa tus credenciales para continuar</p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="username" className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                  Usuario
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full px-4 py-3.5 lg:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 outline-none transition-all text-base lg:text-sm backdrop-blur-sm"
                  placeholder="Tu usuario"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
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
                    className="w-full px-4 py-3.5 lg:py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 outline-none transition-all pr-12 text-base lg:text-sm backdrop-blur-sm"
                    placeholder="Tu contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
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

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-gray-900 font-bold py-3.5 lg:py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/20"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Ingresando...
                    </span>
                  ) : 'LOGIN'}
                </button>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10">
            <p className="text-gray-400 text-xs text-center">
              © 2026 <span className="text-yellow-400 font-semibold">Monay Solutions</span>. Todos los derechos reservados.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
