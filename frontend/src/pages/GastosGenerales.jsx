import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, PaperClipIcon } from '@heroicons/react/24/outline'
import { getExpenses, createExpense, updateExpense, deleteExpense, getComprobante } from '../services/expensesApi'
import MonthPicker from '../components/MonthPicker'

function formatCLP(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return '$0'
  return '$' + num.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

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

function formatMonth(yearMonth) {
  const [year, month] = yearMonth.split('-')
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ]
  return `${months[Number.parseInt(month, 10) - 1]} ${year}`
}

const DOCUMENT_TYPE_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'boleta', label: 'Boleta' },
  { value: 'factura', label: 'Factura' },
  { value: 'honorario', label: 'Honorario' },
  { value: 'recibo', label: 'Recibo' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'otro', label: 'Otro' },
]

function ExpenseFormModal({ expense, onClose, onSuccess }) {
  const isEditing = Boolean(expense)
  const fileInputRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const [form, setForm] = useState({
    date: '',
    detail: '',
    total_amount: '',
    document_number: '',
    document_type: '',
    provider: '',
    observations: '',
    is_company_invoice: false,
  })
  const [file, setFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [hasCamera, setHasCamera] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [cameraStream, setCameraStream] = useState(null)

  // Detect camera support
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setHasCamera(true)
    } else {
      setHasCamera(false)
    }
  }, [])

  // Cleanup camera stream on unmount or when closing camera
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [cameraStream])

  // Pre-fill form when editing
  useEffect(() => {
    if (expense) {
      setForm({
        date: expense.date || '',
        detail: expense.detail || '',
        total_amount: parseInt(expense.total_amount, 10) || '',
        document_number: expense.document_number || '',
        document_type: expense.document_type || '',
        provider: expense.provider || '',
        observations: expense.observations || '',
        is_company_invoice: expense.is_company_invoice || false,
      })
      if (expense.file_name) {
        setFileName(expense.file_name)
      }
    }
  }, [expense])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    // Clear field error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setFileName(selected.name)
    }
  }

  const handleCameraClick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      setCameraStream(stream)
      setShowCamera(true)
      // Wait for video element to be in DOM
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      }, 100)
    } catch {
      setFormError('No se pudo acceder a la cámara')
    }
  }

  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) {
        const capturedFile = new File([blob], `captura_${Date.now()}.jpg`, { type: 'image/jpeg' })
        setFile(capturedFile)
        setFileName(capturedFile.name)
      }
      handleCloseCamera()
    }, 'image/jpeg', 0.85)
  }

  const handleCloseCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop())
      setCameraStream(null)
    }
    setShowCamera(false)
  }

  const validate = () => {
    const newErrors = {}
    if (!form.date) newErrors.date = 'La fecha es obligatoria'
    if (!form.detail.trim()) newErrors.detail = 'El detalle es obligatorio'
    if (!form.total_amount) {
      newErrors.total_amount = 'El monto es obligatorio'
    } else if (Number.isNaN(Number(form.total_amount)) || Number(form.total_amount) <= 0) {
      newErrors.total_amount = 'El monto debe ser un número mayor a cero'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!validate()) return

    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('date', form.date)
      formData.append('detail', form.detail.trim())
      formData.append('total_amount', form.total_amount)
      if (form.document_number.trim()) formData.append('document_number', form.document_number.trim())
      if (form.document_type) formData.append('document_type', form.document_type)
      if (form.provider.trim()) formData.append('provider', form.provider.trim())
      if (form.observations.trim()) formData.append('observations', form.observations.trim())
      formData.append('is_company_invoice', form.is_company_invoice)
      if (file) formData.append('file', file)

      if (isEditing) {
        await updateExpense(expense.id, formData)
        onSuccess('Gasto actualizado correctamente')
      } else {
        await createExpense(formData)
        onSuccess('Gasto creado correctamente')
      }
    } catch (err) {
      const data = err.response?.data
      if (data) {
        // Map backend field errors
        const fieldErrors = {}
        if (data.date) fieldErrors.date = Array.isArray(data.date) ? data.date[0] : data.date
        if (data.detail) fieldErrors.detail = Array.isArray(data.detail) ? data.detail[0] : data.detail
        if (data.total_amount) fieldErrors.total_amount = Array.isArray(data.total_amount) ? data.total_amount[0] : data.total_amount
        if (data.file) fieldErrors.file = Array.isArray(data.file) ? data.file[0] : data.file
        setErrors(fieldErrors)

        const generalMsg = data.detail || data.non_field_errors?.[0] || ''
        if (generalMsg && !fieldErrors.detail) {
          setFormError(generalMsg)
        } else if (Object.keys(fieldErrors).length === 0) {
          setFormError('Error al guardar el gasto')
        }
      } else {
        setFormError('Error al guardar el gasto')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 animate-fade-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? 'Editar Gasto' : 'Nuevo Gasto'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {formError}
            </div>
          )}

          {/* Fecha */}
          <div>
            <label htmlFor="expense-date" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              id="expense-date"
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              required
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                errors.date ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
          </div>

          {/* Detalle */}
          <div>
            <label htmlFor="expense-detail" className="block text-sm font-medium text-gray-700 mb-1">
              Detalle <span className="text-red-500">*</span>
            </label>
            <input
              id="expense-detail"
              name="detail"
              type="text"
              value={form.detail}
              onChange={handleChange}
              placeholder="Descripción del gasto"
              required
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                errors.detail ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.detail && <p className="mt-1 text-xs text-red-500">{errors.detail}</p>}
          </div>

          {/* Monto Total */}
          <div>
            <label htmlFor="expense-amount" className="block text-sm font-medium text-gray-700 mb-1">
              Monto Total <span className="text-red-500">*</span>
            </label>
            <input
              id="expense-amount"
              name="total_amount"
              type="text"
              inputMode="numeric"
              value={form.total_amount ? formatNumberWithThousands(form.total_amount) : ''}
              onFocus={(e) => {
                const num = parseNumberFromThousands(form.total_amount)
                e.target.value = num
              }}
              onBlur={(e) => {
                const num = parseNumberFromThousands(e.target.value)
                setForm((prev) => ({ ...prev, total_amount: num || '' }))
              }}
              onChange={(e) => {
                const rawValue = e.target.value
                const num = parseNumberFromThousands(rawValue)
                setForm((prev) => ({ ...prev, total_amount: num || '' }))
              }}
              placeholder="Ej: 45.000"
              required
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                errors.total_amount ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {errors.total_amount && <p className="mt-1 text-xs text-red-500">{errors.total_amount}</p>}
          </div>

          {/* N° Documento */}
          <div>
            <label htmlFor="expense-docnum" className="block text-sm font-medium text-gray-700 mb-1">
              N° Documento
            </label>
            <input
              id="expense-docnum"
              name="document_number"
              type="text"
              value={form.document_number}
              onChange={handleChange}
              placeholder="Ej: B-001234"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {/* Tipo Documento */}
          <div>
            <label htmlFor="expense-doctype" className="block text-sm font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <select
              id="expense-doctype"
              name="document_type"
              value={form.document_type}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
            >
              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Proveedor */}
          <div>
            <label htmlFor="expense-provider" className="block text-sm font-medium text-gray-700 mb-1">
              Proveedor
            </label>
            <input
              id="expense-provider"
              name="provider"
              type="text"
              value={form.provider}
              onChange={handleChange}
              placeholder="Nombre del proveedor"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {/* Observaciones */}
          <div>
            <label htmlFor="expense-observations" className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones
            </label>
            <textarea
              id="expense-observations"
              name="observations"
              value={form.observations}
              onChange={handleChange}
              placeholder="Notas adicionales..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
            />
          </div>

          {/* Factura empresa */}
          <div className="flex items-center gap-3">
            <input
              id="expense-company-invoice"
              name="is_company_invoice"
              type="checkbox"
              checked={form.is_company_invoice}
              onChange={(e) => setForm((prev) => ({ ...prev, is_company_invoice: e.target.checked }))}
              className="w-4 h-4 text-yellow-500 border-gray-300 rounded focus:ring-yellow-400"
            />
            <label htmlFor="expense-company-invoice" className="text-sm font-medium text-gray-700">
              ¿Factura con RUT empresa?
            </label>
          </div>

          {/* Archivo / Comprobante */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comprobante
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Seleccionar archivo
              </button>
              {hasCamera && (
                <button
                  type="button"
                  onClick={handleCameraClick}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Abrir cámara"
                >
                  📷
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            {fileName && (
              <p className="mt-2 text-xs text-gray-600 flex items-center gap-1">
                <PaperClipIcon className="w-3 h-3" />
                {fileName}
              </p>
            )}
            {errors.file && <p className="mt-1 text-xs text-red-500">{errors.file}</p>}

            {/* Camera viewfinder */}
            {showCamera && (
              <div className="mt-3 rounded-lg overflow-hidden border border-gray-300 bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-64 object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex items-center justify-center gap-3 p-3 bg-gray-900">
                  <button
                    type="button"
                    onClick={handleCloseCamera}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    className="px-4 py-2 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
                  >
                    📸 Capturar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function GastosGenerales() {
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState(null)

  const fetchGastos = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getExpenses()
      const data = res.data?.results ?? res.data ?? []
      setGastos(data)
    } catch {
      setError('No se pudieron cargar los gastos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGastos()
  }, [fetchGastos])

  const showSuccess = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  // Compute available months from gastos data
  const availableMonths = useMemo(() => {
    const set = new Set()
    gastos.forEach(gasto => {
      const dateField = gasto.date
      if (dateField) {
        const [y, m] = dateField.substring(0, 7).split('-')
        set.add(JSON.stringify({ year: parseInt(y), month: parseInt(m) }))
      }
    })
    return [...set].map(s => JSON.parse(s))
  }, [gastos])

  // Filter gastos by selected period
  const filteredGastos = useMemo(() => {
    if (!selectedPeriod) return gastos
    return gastos.filter(gasto => {
      const dateField = gasto.date
      if (!dateField) return false
      const [y, m] = dateField.substring(0, 7).split('-')
      return parseInt(y) === selectedPeriod.year && parseInt(m) === selectedPeriod.month
    })
  }, [gastos, selectedPeriod])

  // Group expenses by month (YYYY-MM), sorted most recent first
  const grouped = useMemo(() => {
    const groups = {}
    filteredGastos.forEach((gasto) => {
      const key = gasto.date.substring(0, 7)
      if (!groups[key]) groups[key] = []
      groups[key].push(gasto)
    })
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [filteredGastos])

  const totalGeneral = useMemo(
    () => filteredGastos.reduce((sum, g) => sum + Number.parseFloat(g.total_amount || 0), 0),
    [filteredGastos]
  )

  // Delete handler with confirmation
  const handleDelete = async (gasto) => {
    if (!globalThis.confirm(`¿Eliminar el gasto "${gasto.detail}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteExpense(gasto.id)
      showSuccess('Gasto eliminado correctamente')
      fetchGastos()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo eliminar el gasto')
    }
  }

  // View comprobante handler
  const handleViewComprobante = async (gasto) => {
    try {
      const res = await getComprobante(gasto.id)
      const blob = res.data
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      // Cleanup after a delay
      setTimeout(() => URL.revokeObjectURL(url), 30000)
    } catch {
      setError('No se pudo abrir el comprobante')
    }
  }

  // Edit handler
  const handleEdit = (gasto) => {
    setEditingExpense(gasto)
    setShowForm(true)
  }

  // New expense handler
  const handleNew = () => {
    setEditingExpense(null)
    setShowForm(true)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gastos Generales</h1>
          <p className="text-gray-500 mt-1">Control de egresos operativos de la empresa</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedPeriod && (
            <button
              onClick={() => setSelectedPeriod(null)}
              className="text-xs text-yellow-600 hover:text-yellow-700 font-medium"
            >
              Ver todos
            </button>
          )}
          <MonthPicker
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            availableMonths={availableMonths}
          />
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Nuevo Gasto
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          {successMsg}
        </div>
      )}

      {/* Grand total */}
      {!loading && gastos.length > 0 && (
        <div className="bg-gray-900 rounded-xl px-6 py-4 flex items-center justify-between">
          <span className="text-white font-medium">Total General</span>
          <span className="text-yellow-400 text-xl font-bold">{formatCLP(totalGeneral)}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      ) : gastos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <span className="text-5xl mb-3">🧾</span>
          <p className="text-sm">No hay gastos registrados</p>
          <p className="text-xs mt-1">Registra tu primer gasto para comenzar</p>
        </div>
      ) : filteredGastos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <span className="text-5xl mb-3">🧾</span>
          <p className="text-sm">No hay gastos en este período</p>
          <button
            onClick={() => setSelectedPeriod(null)}
            className="mt-3 text-yellow-600 hover:text-yellow-700 font-medium text-sm"
          >
            Ver todos los meses
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([month, monthGastos]) => {
            const subtotal = monthGastos.reduce(
              (sum, g) => sum + Number.parseFloat(g.total_amount || 0),
              0
            )

            return (
              <div key={month} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Month header */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-gray-900">
                  <h2 className="text-lg font-bold text-yellow-400">
                    {formatMonth(month)}
                  </h2>
                  <span className="text-white text-sm font-medium">
                    Subtotal: <span className="text-yellow-400">{formatCLP(subtotal)}</span>
                  </span>
                </div>

                {/* Expenses table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 sm:px-6 py-3 font-semibold text-gray-600">Fecha</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Detalle</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Monto</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Tipo Doc.</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Proveedor</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Observaciones</th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-600 w-10">📎</th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-600 w-24">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {monthGastos.map((gasto) => (
                        <tr key={gasto.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 sm:px-6 py-3 text-gray-700 whitespace-nowrap">
                            {gasto.date}
                          </td>
                          <td className="px-4 py-3 text-gray-900">
                            {gasto.detail}
                            {gasto.is_company_invoice && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700" title="Factura con RUT empresa">
                                🏢 Empresa
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">
                            {formatCLP(gasto.total_amount)}
                          </td>
                          <td className="px-4 py-3 text-gray-600 hidden sm:table-cell capitalize">
                            {gasto.document_type || '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                            {gasto.provider || '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-500 hidden lg:table-cell text-xs">
                            {gasto.observations || '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {gasto.tiene_comprobante && (
                              <button
                                onClick={() => handleViewComprobante(gasto)}
                                className="p-1 text-yellow-600 hover:text-yellow-800 transition-colors"
                                title="Ver comprobante"
                              >
                                <PaperClipIcon className="w-4 h-4 inline-block" />
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleEdit(gasto)}
                                className="p-1.5 text-gray-400 hover:text-yellow-600 transition-colors"
                                title="Editar"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(gasto)}
                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                                title="Eliminar"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal with expense form */}
      {showForm && (
        <ExpenseFormModal
          expense={editingExpense}
          onClose={() => { setShowForm(false); setEditingExpense(null) }}
          onSuccess={(msg) => {
            setShowForm(false)
            setEditingExpense(null)
            showSuccess(msg)
            fetchGastos()
          }}
        />
      )}
    </div>
  )
}
