import { useState, useEffect } from 'react'
import { getSMTPConfig, saveSMTPConfig, updateSMTPConfig, testSMTPConnection } from '../services/smtpApi'

const PROVIDER_PRESETS = {
  gmail: {
    label: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    useTls: true,
    useSsl: false,
  },
  outlook: {
    label: 'Outlook / Hotmail',
    host: 'smtp.office365.com',
    port: 587,
    useTls: true,
    useSsl: false,
  },
  yahoo: {
    label: 'Yahoo Mail',
    host: 'smtp.mail.yahoo.com',
    port: 587,
    useTls: true,
    useSsl: false,
  },
  custom: {
    label: 'Otro servidor (dominio propio)',
    host: '',
    port: 587,
    useTls: true,
    useSsl: false,
  },
}

export default function SMTPConfigForm({ onSaved }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [provider, setProvider] = useState('custom')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('587')
  const [useTls, setUseTls] = useState(true)
  const [useSsl, setUseSsl] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [hasExistingConfig, setHasExistingConfig] = useState(false)
  const [existingEmail, setExistingEmail] = useState('')
  const [saving, setSaving] = useState(false)

  // Cargar configuración existente
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await getSMTPConfig()
        const config = res.data
        setExistingEmail(config.smtp_user || '')
        setHasExistingConfig(true)
      } catch {
        setHasExistingConfig(false)
      }
    }
    fetchConfig()
  }, [])

  // Cuando cambia el proveedor, limpiar campos y aplicar preset
  const handleProviderChange = (newProvider) => {
    setProvider(newProvider)
    const preset = PROVIDER_PRESETS[newProvider]
    if (preset) {
      setHost(preset.host)
      setPort(String(preset.port))
      setUseTls(preset.useTls)
      setUseSsl(preset.useSsl)
    }
    // Limpiar campos del formulario al cambiar proveedor
    setEmail('')
    setPassword('')
    setError('')
    setSuccess('')
  }

  // Auto-configurar TLS/SSL según puerto
  const handlePortChange = (newPort) => {
    setPort(newPort)
    const p = parseInt(newPort, 10)
    if (p === 465) {
      setUseSsl(true)
      setUseTls(false)
    } else if (p === 587 || p === 25) {
      setUseTls(true)
      setUseSsl(false)
    }
  }

  const isCustom = provider === 'custom'
  const isGmailLike = provider === 'gmail' || provider === 'outlook' || provider === 'yahoo'

  const handleTest = async () => {
    setTesting(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        smtp_host: host,
        smtp_port: parseInt(port, 10) || 587,
        smtp_user: email,
        smtp_password: password,
        use_tls: useTls,
        use_ssl: useSsl,
      }
      await testSMTPConnection(payload)
      setSuccess('Conexión exitosa. Ahora puedes guardar la configuración.')
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      const msg = err.response?.data?.detail || 'No se pudo conectar. Revisa los datos.'
      setError(msg)
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Completa el correo y la contraseña')
      return
    }
    if (isCustom && !host) {
      setError('Completa el servidor SMTP')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        smtp_host: host,
        smtp_port: parseInt(port, 10) || 587,
        smtp_user: email,
        smtp_password: password,
        use_tls: useTls,
        use_ssl: useSsl,
        is_active: true,
      }
      if (hasExistingConfig) {
        await updateSMTPConfig(payload)
      } else {
        await saveSMTPConfig(payload)
      }
      setSuccess('Configuración guardada correctamente')
      setPassword('')
      setExistingEmail(email)
      setEmail('')
      setHasExistingConfig(true)
      setTimeout(() => setSuccess(''), 5000)
      onSaved?.()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al guardar la configuración'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = (hasError) =>
    `w-full px-3 py-2 bg-white border rounded-lg text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-400 outline-none ${
      hasError ? 'border-red-400' : 'border-gray-300'
    }`

  return (
    <div className="space-y-5">
      {/* Estado actual */}
      {hasExistingConfig && existingEmail && (
        <div className="flex flex-col gap-1 border-l-4 border-green-400 pl-3">
          <p className="text-sm text-green-800">
            Configurado para: <strong>{existingEmail}</strong>
          </p>
          <p className="text-xs text-green-600">
            Si guardas una nueva configuración, reemplazará la actual.
          </p>
        </div>
      )}

      {/* Instrucciones según proveedor */}
      {isGmailLike && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1">Paso 1</p>
            <p className="text-sm font-bold text-amber-900 mb-2">Verificación en 2 pasos</p>
            <p className="text-sm text-amber-800 mb-2">
              Debes tener activa la <strong>Verificación en dos pasos</strong> para generar contraseñas de aplicación.
            </p>
            <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
              <li>
                Ve a{' '}
                <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                  Seguridad e inicio de sesión
                </a>
              </li>
              <li>Activa <strong>"Verificación en dos pasos"</strong></li>
            </ol>
            <p className="text-xs text-amber-600 mt-2 italic">
              Si dice "La opción no está disponible", es porque falta activar este paso.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-1">Paso 2</p>
            <p className="text-sm font-bold text-blue-800 mb-2">Generar contraseña de aplicación</p>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>
                Abre{' '}
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                  Contraseñas de aplicación
                </a>
              </li>
              <li>Escribe <strong>Cotizador</strong> como nombre → <strong>Crear</strong></li>
              <li>Copia los <strong>16 caracteres</strong> sin espacios y pégalos abajo</li>
            </ol>
          </div>
        </div>
      )}

      {isCustom && (
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-sm font-bold text-gray-800 mb-1">Correo con dominio propio</p>
          <p className="text-sm text-gray-600">
            Ingresa los datos SMTP que te proporcionó tu proveedor de hosting. 
            Usa puerto <strong>587</strong> para TLS o <strong>465</strong> para SSL.
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Proveedor de correo
            </label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className={fieldClass(false)}
            >
              {Object.entries(PROVIDER_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>{preset.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isCustom ? 'juan@empresa.com' : 'tucorreo@gmail.com'}
              className={fieldClass(false)}
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
              {isGmailLike ? 'Contraseña de aplicación' : 'Contraseña'} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(isGmailLike ? e.target.value.replace(/\s/g, '') : e.target.value)}
                placeholder={isGmailLike ? 'Los 16 caracteres sin espacios' : 'Tu contraseña de correo'}
                className={`${fieldClass(false)} pr-20`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 underline"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {isGmailLike && (
              <p className="text-xs text-gray-400 mt-1">
                No es tu contraseña de Gmail. Son los 16 caracteres generados en Google.
              </p>
            )}
          </div>
        </div>

        {/* Campos SMTP solo para custom */}
        {isCustom && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                Servidor SMTP (host)
                <span className="relative inline-block ml-1 group">
                  <span className="cursor-help inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold">?</span>
                  <span className="hidden group-hover:block absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg leading-relaxed">
                    Es la dirección del servidor de correo de tu proveedor de hosting. Ejemplos:
                    <br /><br />
                    <strong>cPanel:</strong> mail.tudominio.cl<br />
                    <strong>Plesk:</strong> smtp.tudominio.cl<br />
                    <strong>Zoho:</strong> smtp.zoho.com<br />
                    <br />
                    Consulta con tu proveedor si no lo conoces.
                  </span>
                </span>
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="mail.empresa.com"
                className={fieldClass(!host)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                Puerto
              </label>
              <select
                value={port}
                onChange={(e) => handlePortChange(e.target.value)}
                className={fieldClass(false)}
              >
                <option value="587">587 (TLS)</option>
                <option value="465">465 (SSL)</option>
                <option value="25">25 (Sin encriptación)</option>
              </select>
            </div>
          </div>
        )}

        {/* Info para Gmail/Outlook preconfigurado */}
        {!isCustom && host && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600">
            <span className="font-medium">{host}</span>
            <span className="text-gray-400">·</span>
            <span>Puerto {port}</span>
            <span className="text-gray-400">·</span>
            <span>{useTls ? 'TLS' : 'SSL'}</span>
            <span className="text-xs text-gray-400 ml-auto">Configuración automática</span>
          </div>
        )}

        {/* Botones */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !email || !password || (isCustom && !host)}
            className="px-4 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {testing ? 'Probando...' : 'Probar conexión'}
          </button>
          <button
            type="submit"
            disabled={saving || !email || !password || (isCustom && !host)}
            className="px-5 py-2.5 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </form>
    </div>
  )
}
