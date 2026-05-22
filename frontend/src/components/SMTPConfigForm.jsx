import { useState, useEffect } from 'react'
import { getSMTPConfig, saveSMTPConfig, updateSMTPConfig, patchSMTPConfig, testSMTPConnection } from '../services/smtpApi'
import { EnvelopeIcon } from '@heroicons/react/24/outline'

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
  'outlook-com': {
    label: 'Outlook.com',
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
    label: 'Otro servidor',
    host: '',
    port: 587,
    useTls: true,
    useSsl: false,
  },
}

function detectProvider(email) {
  if (!email) return null
  const domain = email.split('@')[1]?.toLowerCase() || ''
  if (domain === 'gmail.com') return 'gmail'
  if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com' || domain === 'msn.com') return 'outlook'
  if (domain === 'yahoo.com' || domain.endsWith('.yahoo.com')) return 'yahoo'
  return 'custom'
}

export default function SMTPConfigForm({ onSaved }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [provider, setProvider] = useState('custom')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('587')
  const [useTls, setUseTls] = useState(true)
  const [useSsl, setUseSsl] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [hasExistingConfig, setHasExistingConfig] = useState(false)

  // Cargar configuración existente
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await getSMTPConfig()
        const config = res.data
        setEmail(config.smtp_user || '')
        setHost(config.smtp_host || '')
        setPort(String(config.smtp_port || 587))
        setUseTls(config.use_tls ?? true)
        setUseSsl(config.use_ssl ?? false)
        setHasExistingConfig(true)

        const detected = detectProvider(config.smtp_user || '')
        setProvider(detected || 'custom')
      } catch {
        setHasExistingConfig(false)
      }
    }
    fetchConfig()
  }, [])

  // Autodetecta proveedor al escribir el correo
  useEffect(() => {
    if (!email) return
    const detected = detectProvider(email)
    if (detected && detected !== 'custom') {
      setProvider(detected)
      const preset = PROVIDER_PRESETS[detected]
      if (preset) {
        setHost(preset.host)
        setPort(String(preset.port))
        setUseTls(preset.useTls)
        setUseSsl(preset.useSsl)
      }
    }
  }, [email])

  // Campos adicionales solo para proveedor custom
  const isCustom = provider === 'custom'

  const handleTest = async () => {
    setTesting(true)
    setError('')
    try {
      const payload = {
        smtp_host: host,
        smtp_port: parseInt(port, 10) || 587,
        smtp_user: email,
        smtp_password: password || 'placeholder',
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

  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !host) {
      setError('Completa el correo y el servidor SMTP')
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
        smtp_password: password || undefined,
        use_tls: useTls,
        use_ssl: useSsl,
        is_active: true,
      }
      if (hasExistingConfig) {
        const { smtp_password: _pw, ...patchData } = payload
        await patchSMTPConfig(patchData)
        if (password) {
          await updateSMTPConfig(payload)
        }
      } else {
        await saveSMTPConfig(payload)
      }
      setSuccess('Configuración de correo guardada correctamente')
      setPassword('')
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
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <EnvelopeIcon className="w-5 h-5 text-primary-700" />
          Configuración de correo para envío de cotizaciones
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Tu correo se usará como remitente cuando envíes cotizaciones a tus clientes.
        </p>
      </div>

      {/* Bloque de instrucciones */}
      <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
        <p className="text-sm font-semibold text-blue-800 mb-2">
          ¿Cómo obtener la contraseña de aplicación?
        </p>
        <ol className="text-sm text-blue-700 space-y-1.5 list-decimal list-inside">
          <li>
            Abre la página de contraseñas de Google:{' '}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium hover:text-blue-900"
            >
              myaccount.google.com/apppasswords
            </a>
          </li>
          <li>Elige <strong>App: Correo</strong> y <strong>Dispositivo: Otro</strong></li>
          <li>Escribe <strong>Cotizador</strong> como nombre y dale a <strong>Generar</strong></li>
          <li>Copia los <strong>16 caracteres</strong> y pégalos abajo (sin espacios)</li>
        </ol>
        <p className="text-xs text-blue-600 mt-2">
          No es tu contraseña de Gmail. Es una clave temporal que genera Google solo para esta app.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Proveedor */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
            Proveedor de correo
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className={fieldClass(false)}
          >
            {Object.entries(PROVIDER_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>{preset.label}</option>
            ))}
          </select>
        </div>

        {/* Correo */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
            Tu correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="murzuay@gmail.com"
            className={fieldClass(false)}
            required
          />
        </div>

        {/* Contraseña de aplicación */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
            Contraseña de aplicación <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/\s/g, ''))}
              placeholder="Los 16 caracteres sin espacios"
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
          <p className="text-xs text-gray-400 mt-1">
            Generada en Google con el nombre <strong>Cotizador</strong>
          </p>
        </div>

        {/* Campos SMTP (solo para proveedor custom) */}
        {isCustom && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                Servidor SMTP (host)
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="mail.tuempresa.cl"
                className={fieldClass(!host)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                Puerto
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="587"
                className={fieldClass(!port)}
              />
            </div>
            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useTls}
                  onChange={(e) => { setUseTls(e.target.checked); if (e.target.checked) setUseSsl(false) }}
                  className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
                />
                TLS
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSsl}
                  onChange={(e) => { setUseSsl(e.target.checked); if (e.target.checked) setUseTls(false) }}
                  className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
                />
                SSL
              </label>
            </div>
          </div>
        )}

        {/* Info para Gmail/Outlook preconfigurado */}
        {!isCustom && host && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600">
            <span className="font-medium">{host}</span>
            <span className="text-gray-400">|</span>
            <span>Puerto {port}</span>
            <span className="text-gray-400">|</span>
            <span>{useTls ? 'TLS activado' : 'SSL activado'}</span>
          </div>
        )}

        {/* Botones */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !email || !host}
            className="px-4 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {testing ? 'Probando...' : 'Probar conexión'}
          </button>
          <button
            type="submit"
            disabled={loading || !email || !host}
            className="px-5 py-2.5 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </form>
    </div>
  )
}
