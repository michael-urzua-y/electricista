import { useState, useEffect } from 'react'

/**
 * Validates a Chilean RUT (supports XX.XXX.XXX-X and XXXXXXXX-X formats).
 * Returns true if valid, false otherwise.
 */
function validateRut(rut) {
  if (!rut || typeof rut !== 'string') return false
  // Remove dots and spaces, keep hyphen
  const cleaned = rut.replace(/\./g, '').replace(/\s/g, '').toUpperCase()
  const match = cleaned.match(/^(\d{1,8})-([0-9K])$/)
  if (!match) return false

  const body = match[1]
  const dv = match[2]

  // Módulo 11
  let sum = 0
  let multiplier = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }
  const remainder = 11 - (sum % 11)
  let expected
  if (remainder === 11) expected = '0'
  else if (remainder === 10) expected = 'K'
  else expected = String(remainder)

  return dv === expected
}

/**
 * Formats a raw RUT string to XX.XXX.XXX-X format as the user types.
 */
function formatRut(value) {
  // Remove everything except digits and K
  const raw = value.replace(/[^0-9kK]/g, '').toUpperCase()
  if (raw.length === 0) return ''
  if (raw.length === 1) return raw

  const body = raw.slice(0, -1)
  const dv = raw.slice(-1)

  // Add dots every 3 digits from right
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${dv}`
}

export default function ClientForm({ client, onSave, onCancel }) {
  const isEditing = Boolean(client)

  const [form, setForm] = useState({
    rut: '',
    name: '',
    email: '',
    phone: '',
    address: '',
  })
  const [rutError, setRutError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (client) {
      setForm({
        rut: client.rut || '',
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
      })
    }
  }, [client])

  const handleRutChange = (e) => {
    const raw = e.target.value
    const formatted = formatRut(raw)
    setForm(prev => ({ ...prev, rut: formatted }))

    if (formatted.length > 3) {
      if (!validateRut(formatted)) {
        setRutError('RUT inválido')
      } else {
        setRutError('')
      }
    } else {
      setRutError('')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!isEditing && !validateRut(form.rut)) {
      setRutError('RUT inválido')
      return
    }

    setSaving(true)
    try {
      await onSave(form)
    } catch (err) {
      const data = err.response?.data
      if (data) {
        const msgs = Object.values(data).flat().join(' ')
        setError(msgs || 'Error al guardar el cliente')
      } else {
        setError('Error al guardar el cliente')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* RUT */}
      <div>
        <label htmlFor="rut" className="block text-sm font-medium text-gray-700 mb-1">
          RUT <span className="text-red-500">*</span>
        </label>
        <input
          id="rut"
          name="rut"
          type="text"
          value={form.rut}
          onChange={handleRutChange}
          disabled={isEditing}
          placeholder="12.345.678-9"
          required
          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
            isEditing
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200'
              : rutError
              ? 'border-red-400 focus:ring-red-300'
              : 'border-gray-300'
          }`}
        />
        {rutError && <p className="mt-1 text-xs text-red-500">{rutError}</p>}
        {isEditing && (
          <p className="mt-1 text-xs text-gray-400">El RUT no puede modificarse una vez creado.</p>
        )}
      </div>

      {/* Nombre */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Nombre completo <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          value={form.name}
          onChange={handleChange}
          placeholder="Nombre del cliente o empresa"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="correo@ejemplo.cl"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      {/* Teléfono */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
          Teléfono
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={form.phone}
          onChange={handleChange}
          placeholder="+56 9 1234 5678"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      {/* Dirección */}
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
          Dirección
        </label>
        <input
          id="address"
          name="address"
          type="text"
          value={form.address}
          onChange={handleChange}
          placeholder="Calle, número, ciudad"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || (!isEditing && Boolean(rutError))}
          className="px-4 py-2 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear cliente'}
        </button>
      </div>
    </form>
  )
}
