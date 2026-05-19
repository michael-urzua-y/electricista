import { useState, useEffect } from 'react'

function formatNumberWithThousands(value) {
  if (!value && value !== 0) return ''
  const num = parseFloat(String(value).replace(',', '.'))
  if (Number.isNaN(num)) return ''
  return num.toLocaleString('es-CL')
}

function parseNumberFromThousands(value) {
  if (!value) return ''
  const normalized = String(value).replace(/\./g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return Number.isNaN(num) ? '' : num.toString()
}

/**
  * PriceSubItemForm — Modal para crear/editar un Sub-Ítem de precios.
  * Props:
  *   subItem  - objeto existente (null para crear)
  *   onSave   - callback({ description, net_value })
  *   onCancel - callback para cerrar
  */
export default function PriceSubItemForm({ subItem, onSave, onCancel }) {
  const [description, setDescription] = useState('')
  const [netValue, setNetValue] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (subItem) {
      setDescription(subItem.description || '')
      setNetValue(subItem.net_value?.toString() || '')
    }
  }, [subItem])

  const validate = () => {
    const newErrors = {}
    if (!description.trim()) {
      newErrors.description = 'La descripción es obligatoria.'
    }
    const numValue = parseFloat(netValue)
    if (!netValue || isNaN(numValue)) {
      newErrors.net_value = 'El valor neto debe ser un número válido.'
    } else if (numValue < 0) {
      newErrors.net_value = 'El valor neto debe ser positivo o cero.'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      await onSave({
        description: description.trim(),
        net_value: parseFloat(netValue),
      })
    } catch (err) {
      const data = err.response?.data
      if (data) {
        setErrors({
          description: data.description?.[0] || '',
          net_value: data.net_value?.[0] || '',
          general: data.detail || '',
        })
      } else {
        setErrors({ general: 'Error al guardar' })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors.general && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {errors.general}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción del servicio
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej: Instalación punto de red Cat 6..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
          autoFocus
        />
        {errors.description && (
          <p className="mt-1 text-xs text-red-500">{errors.description}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Valor Neto (CLP)
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={netValue ? formatNumberWithThousands(netValue) : ''}
          onFocus={(e) => {
            e.target.value = parseNumberFromThousands(netValue)
          }}
          onBlur={(e) => {
            const num = parseNumberFromThousands(e.target.value)
            setNetValue(num || '')
          }}
          onChange={(e) => {
            const num = parseNumberFromThousands(e.target.value)
            setNetValue(num || '')
          }}
          placeholder="Ej: 45.000"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
        {errors.net_value && (
          <p className="mt-1 text-xs text-red-500">{errors.net_value}</p>
        )}
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
          {saving ? 'Guardando...' : subItem ? 'Guardar Cambios' : 'Agregar Sub-Ítem'}
        </button>
      </div>
    </form>
  )
}
