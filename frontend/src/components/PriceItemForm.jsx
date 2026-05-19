import { useState, useEffect } from 'react'

/**
 * PriceItemForm — Modal para crear/editar un Ítem (categoría) de precios.
 * Props:
 *   item     - objeto existente (null para crear)
 *   onSave   - callback({ name })
 *   onCancel - callback para cerrar
 */
export default function PriceItemForm({ item, onSave, onCancel }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) {
      setName(item.name || '')
    }
  }, [item])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }

    setSaving(true)
    try {
      await onSave({ name: name.trim() })
    } catch (err) {
      const msg = err.response?.data?.name?.[0] || err.response?.data?.detail || 'Error al guardar'
      setError(msg)
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nombre de la categoría
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: PUNTO DE RED, FIBRA ÓPTICA..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          autoFocus
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : item ? 'Guardar Cambios' : 'Crear Ítem'}
        </button>
      </div>
    </form>
  )
}
