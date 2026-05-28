import { useState, useEffect, useMemo } from 'react'
import api from '../services/api'
import {
  PlusIcon,
  DocumentIcon,
  EyeIcon,
  XMarkIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import PriceVariationBadge from '../components/PriceVariationBadge'
import Pagination from '../components/Pagination'
import MonthPicker from '../components/MonthPicker'

const PAGE_SIZE = 10

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function HelpTooltip({ text }) {
  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        className="inline-flex items-center justify-center text-gray-400 hover:text-yellow-600 focus:text-yellow-600 focus:outline-none"
        aria-label={text}
      >
        <QuestionMarkCircleIcon className="w-4 h-4" />
      </button>
      <span className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {text}
      </span>
    </span>
  )
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [notification, setNotification] = useState(null)
  const [providers, setProviders] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [pages, setPages] = useState({})
  const [selectedPeriod, setSelectedPeriod] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    file: null,
    issue_date: '',
    received_date: todayISO(),
    invoice_number: '',
    provider: '',
    markup_percentage: 0
  })
  const [formErrors, setFormErrors] = useState({})

  useEffect(() => {
    fetchInvoices()
    fetchProviders()
  }, [])

  // Polling: recargar facturas mientras haya alguna en proceso
  useEffect(() => {
    const hasProcessing = invoices.some(inv => inv.status === 'pending' || inv.status === 'processing')
    if (!hasProcessing) return

    const interval = setInterval(() => {
      fetchInvoices()
    }, 3000)

    return () => clearInterval(interval)
  }, [invoices])

  // Auto-dismiss notification
  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => setNotification(null), 5000)
    return () => clearTimeout(timer)
  }, [notification])

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/facturas/?page_size=1000')
      const data = Array.isArray(res.data) ? res.data : (res.data.results || [])
      
      // Detectar cambios de estado para notificaciones
      if (invoices.length > 0) {
        data.forEach((newInv) => {
          const oldInv = invoices.find(i => i.id === newInv.id)
          if (oldInv && oldInv.status !== newInv.status) {
            if (newInv.status === 'completed') {
              setNotification({ type: 'success', message: `Factura #${newInv.id} procesada correctamente` })
            } else if (newInv.status === 'failed') {
              setNotification({ type: 'error', message: `Factura #${newInv.id} falló al procesar` })
            }
          }
        })
      }
      
      setInvoices(data)
    } catch (error) {
      console.error('Error fetching invoices:', error)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  const fetchProviders = async () => {
    try {
      const res = await api.get('/proveedores/')
      setProviders(Array.isArray(res.data) ? res.data : res.data.results || [])
    } catch (error) {
      console.error('Error fetching providers:', error)
    }
  }

  const fetchInvoiceDetail = async (invoice) => {
    setLoadingDetail(true)
    setSelectedInvoice(invoice)
    try {
      const res = await api.get(`/facturas/${invoice.id}/`)
      setSelectedInvoice(res.data)
    } catch (error) {
      console.error('Error fetching invoice detail:', error)
      // Keep the list-level data as fallback
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, files } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }))
    // Clear error on change
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  const handleProviderChange = (e) => {
    setFormData(prev => ({
      ...prev,
      provider: e.target.value
    }))
    if (formErrors.provider) {
      setFormErrors(prev => ({ ...prev, provider: null }))
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!formData.file) errors.file = 'El archivo es obligatorio'
    if (!formData.issue_date) errors.issue_date = 'La fecha es obligatoria'
    if (!formData.received_date) errors.received_date = 'La recepción es obligatoria'
    if (!formData.provider) errors.provider = 'Selecciona un proveedor'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setUploading(true)
    setUploadError('')
    try {
      const formDataToSend = new FormData()
      formDataToSend.append('file', formData.file)
      // Ensure date is sent in YYYY-MM-DD format without timezone conversion
      // The HTML date input already provides this format
      formDataToSend.append('issue_date', formData.issue_date)
      formDataToSend.append('received_date', formData.received_date || todayISO())
      formDataToSend.append('provider', formData.provider)
      if (formData.invoice_number) {
        formDataToSend.append('invoice_number', formData.invoice_number)
      }
      formDataToSend.append('markup_percentage', formData.markup_percentage)

      await api.post('/facturas/', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setFormData({ file: null, issue_date: '', received_date: todayISO(), invoice_number: '', provider: '', markup_percentage: 0 })
      setShowModal(false)
      fetchInvoices()
    } catch (error) {
      setUploadError(error.response?.data?.file?.[0] || 'Error al subir factura')
    } finally {
      setUploading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700'
      case 'processing': return 'bg-yellow-100 text-yellow-700'
      case 'failed': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return 'Completada'
      case 'processing': return 'Procesando...'
      case 'failed': return 'Fallida'
      case 'pending': return 'Pendiente'
      default: return status
    }
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(value || 0)
  }

  const renderVariacion = (variacion) => {
    if (!variacion) return null
    if (variacion.variacion_porcentual != null) {
      return <PriceVariationBadge variacion={variacion.variacion_porcentual} />
    }
    if (variacion.etiqueta === 'nuevo') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
          Nuevo
        </span>
      )
    }
    return null
  }

  const handleVerFactura = async (invoiceId) => {
    try {
      const res = await api.get(`/facturas/${invoiceId}/ver-factura/`, {
        responseType: 'blob'
      })
      const blob = new Blob([res.data], { type: res.headers['content-type'] })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      // Liberar la URL temporal después de un momento
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (error) {
      console.error('Error al obtener la factura:', error)
      setNotification({ type: 'error', message: 'No se pudo cargar el archivo de la factura' })
    }
  }

  const updateItemMarkup = async (itemId, newMarkup) => {
    const parsedMarkup = newMarkup === '' ? 0 : parseInt(newMarkup, 10);
    try {
      await api.patch(`/facturas/${selectedInvoice.id}/update-item/`, {
        item_id: itemId,
        markup_percentage: parsedMarkup
      });
      // Recargar el detalle de la factura para obtener los nuevos precios calculados
      fetchInvoiceDetail(selectedInvoice);
      setNotification({ type: 'success', message: 'Margen actualizado correctamente' });
    } catch (error) {
      console.error('Error actualizando el margen:', error);
      setNotification({ type: 'error', message: 'Error al actualizar el margen' });
    }
  };

  // Compute available months from invoices data
  const availableMonths = useMemo(() => {
    const set = new Set()
    invoices.forEach(inv => {
      const dateField = inv.issue_date
      if (dateField) {
        const [y, m] = dateField.substring(0, 7).split('-')
        set.add(JSON.stringify({ year: parseInt(y), month: parseInt(m) }))
      }
    })
    return [...set].map(s => JSON.parse(s))
  }, [invoices])

  // Filter invoices by selected period
  const filteredInvoices = useMemo(() => {
    if (!selectedPeriod) return invoices
    return invoices.filter(inv => {
      const dateField = inv.issue_date
      if (!dateField) return false
      const [y, m] = dateField.substring(0, 7).split('-')
      return parseInt(y) === selectedPeriod.year && parseInt(m) === selectedPeriod.month
    })
  }, [invoices, selectedPeriod])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Compras</h1>
          <p className="text-gray-500 mt-1">Sube y gestiona tus facturas de compras</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={() => window.location.href = '/proveedores'}
            className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-lg transition-colors text-sm"
          >
            🏪 Proveedores
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 px-4 py-2 rounded-lg font-bold text-sm transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            Subir Factura
          </button>
        </div>
      </div>

      {/* Month filter */}
      <div className="flex items-center gap-2 justify-end">
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
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Subir Nueva Factura</h2>
              <button onClick={() => { setShowModal(false); setFormData({ file: null, issue_date: '', received_date: todayISO(), invoice_number: '', provider: '', markup_percentage: 0 }); setFormErrors({}) }} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {uploadError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Archivo (PDF o imagen)
                </label>
                <input
                  type="file"
                  name="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                {formErrors.file && <p className="text-red-500 text-sm mt-1">{formErrors.file}</p>}
              </div>

              <div>
                <label className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  Fecha de emisión
                  <HelpTooltip text="Fecha que aparece en la factura del proveedor." />
                </label>
                <input
                  type="date"
                  name="issue_date"
                  value={formData.issue_date}
                  onChange={handleChange}
                  max={new Date().toISOString().split('T')[0]}  // No futuro
                  min="2020-01-01"  // No más allá de 2020
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 outline-none"
                />
                {formErrors.issue_date && <p className="text-red-500 text-sm mt-1">{formErrors.issue_date}</p>}
              </div>

              <div>
                <label className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  Fecha de recepción
                  <HelpTooltip text="Fecha en que recibiste la factura. El estimador usa esta fecha para ubicar el IVA crédito." />
                </label>
                <input
                  type="date"
                  name="received_date"
                  value={formData.received_date}
                  onChange={handleChange}
                  max={todayISO()}
                  min="2020-01-01"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 outline-none"
                />
                {formErrors.received_date && <p className="text-red-500 text-sm mt-1">{formErrors.received_date}</p>}
                <p className="text-xs text-gray-500 mt-1">El estimador tributario usa esta fecha para el IVA crédito.</p>
              </div>

               <div>
                 <label className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                   Proveedor
                   <HelpTooltip text="Proveedor emisor de la factura. Se usa para controlar compras, precios e historial." />
                 </label>
                 <select
                   name="provider"
                   value={formData.provider}
                   onChange={handleProviderChange}
                   className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-100 outline-none ${
                     formErrors.provider ? 'border-red-300' : 'border-gray-200'
                   }`}
                 >
                   <option value="">Selecciona un proveedor...</option>
                   {providers.map(p => (
                     <option key={p.id} value={p.id}>
                       {p.name}
                     </option>
                   ))}
                 </select>
                 {formErrors.provider && <p className="text-red-500 text-sm mt-1">{formErrors.provider}</p>}
               </div>

               <div>
                 <label className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                   Número de factura (opcional)
                   <HelpTooltip text="Folio o número del documento. Ayuda a cuadrar con el resumen del contador." />
                 </label>
                 <input
                   type="text"
                   name="invoice_number"
                   value={formData.invoice_number}
                   onChange={handleChange}
                   className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 outline-none"
                   placeholder="Ej: 001-23456789"
                 />
               </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Margen de Ganancia General (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="markup_percentage"
                    value={formData.markup_percentage}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 outline-none pr-8"
                    placeholder="Ej: 15"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Este margen se aplicará a todos los productos por defecto.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormData({ file: null, issue_date: '', received_date: todayISO(), invoice_number: '', provider: '', markup_percentage: 0 }); setFormErrors({}) }}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Subiendo...
                    </>
                  ) : 'Subir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoices grouped by month */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <DocumentIcon className="w-12 h-12 mb-3" />
          <p className="text-sm">No hay facturas registradas</p>
          <button onClick={() => setShowModal(true)} className="mt-4 text-yellow-600 hover:text-yellow-700 font-medium text-sm">
            Subir tu primera factura
          </button>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <DocumentIcon className="w-12 h-12 mb-3" />
          <p className="text-sm">No hay facturas en este período</p>
          <button onClick={() => setSelectedPeriod(null)} className="mt-4 text-yellow-600 hover:text-yellow-700 font-medium text-sm">
            Ver todos los meses
          </button>
        </div>
      ) : (() => {
        // Group invoices by month
        const groups = {}
        filteredInvoices.forEach((inv) => {
          const key = inv.issue_date ? inv.issue_date.substring(0, 7) : 'sin-fecha'
          if (!groups[key]) groups[key] = []
          groups[key].push(inv)
        })
        const sortedMonths = Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))

        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        const formatMonthLabel = (ym) => {
          if (ym === 'sin-fecha') return 'Sin fecha'
          const [year, month] = ym.split('-')
          return `${monthNames[parseInt(month, 10) - 1]} ${year}`
        }

        return (
          <div className="space-y-6">
            {sortedMonths.map(([month, monthInvoices]) => {
              const subtotal = monthInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0)
              const page = pages[month] || 1
              const totalPages = Math.ceil(monthInvoices.length / PAGE_SIZE)
              const paginated = monthInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

              return (
                <div key={month} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Month header */}
                  <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-gray-900">
                    <h2 className="text-lg font-bold text-yellow-400">
                      {formatMonthLabel(month)}
                    </h2>
                    <div className="flex items-center gap-4">
                      <span className="text-white text-sm font-medium hidden sm:inline">
                        {monthInvoices.length} factura(s)
                      </span>
                      <span className="text-white text-sm font-medium">
                        Total: <span className="text-yellow-400">{formatCurrency(subtotal)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-4 sm:px-6 py-3 font-semibold text-gray-600">Factura</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Emisión</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden lg:table-cell">Recepción</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Proveedor</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-600 w-20">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginated.map((invoice) => (
                          <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 sm:px-6 py-3">
                              <p className="font-medium text-gray-900">{invoice.invoice_number || `#${invoice.id}`}</p>
                              {invoice.tiene_archivo && (
                                <button onClick={() => handleVerFactura(invoice.id)} className="text-xs text-yellow-600 hover:underline flex items-center gap-1 mt-0.5">
                                  <DocumentIcon className="w-3 h-3" />
                                  Ver factura
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600 hidden sm:table-cell whitespace-nowrap">
                              {invoice.issue_date ? format(new Date(invoice.issue_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: es }) : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600 hidden lg:table-cell whitespace-nowrap">
                              {invoice.received_date ? format(new Date(invoice.received_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: es }) : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{invoice.provider_name || '—'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(invoice.total_amount)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${getStatusColor(invoice.status)}`}>
                                {(invoice.status === 'pending' || invoice.status === 'processing') && (
                                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                )}
                                {getStatusLabel(invoice.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => fetchInvoiceDetail(invoice)} className="p-1.5 text-gray-400 hover:text-yellow-600 transition-colors" title="Ver detalles">
                                <EyeIcon className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={(p) => setPages(prev => ({ ...prev, [month]: p }))}
                    totalItems={monthInvoices.length}
                    pageSize={PAGE_SIZE}
                  />
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Factura #{selectedInvoice.id} - Detalles
              </h2>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Número</p>
                  <p className="mt-1 text-gray-900">{selectedInvoice.invoice_number || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Fecha</p>
                  <p className="mt-1 text-gray-900">
                    {selectedInvoice.issue_date ? format(new Date(selectedInvoice.issue_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: es }) : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Recepción</p>
                  <p className="mt-1 text-gray-900">
                    {selectedInvoice.received_date ? format(new Date(selectedInvoice.received_date + 'T00:00:00'), 'dd/MM/yyyy', { locale: es }) : 'N/A'}
                  </p>
                </div>
                 <div>
                   <p className="text-xs font-medium text-gray-500 uppercase">Proveedor</p>
                   <p className="mt-1 text-gray-900">{selectedInvoice.provider_name || 'Sin proveedor'}</p>
                 </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Total</p>
                  <p className="mt-1 text-gray-900">{formatCurrency(selectedInvoice.total_amount)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Estado</p>
                  <p className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getStatusColor(selectedInvoice.status)}`}>
                      {getStatusLabel(selectedInvoice.status)}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Ítems</p>
                  <p className="mt-1 text-gray-900">{selectedInvoice.items_count || 0}</p>
                </div>
              </div>

              {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Ítems de la factura</h3>
                  {loadingDetail ? (
                    <div className="text-center py-4 text-gray-400">Cargando detalles...</div>
                  ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Descripción</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Cant.</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">P. Unit.</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-600">Total</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-600">
                            <span className="inline-flex items-center gap-1">
                              Variación
                              <span className="relative group">
                                <span className="cursor-help inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold">!</span>
                                <span className="hidden group-hover:block fixed z-50 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg leading-relaxed" style={{marginTop: '4px'}}>
                                  Compara el precio de cada producto con la factura anterior del mismo proveedor.
                                  <br /><br />
                                  <span className="text-red-300">↑ Rojo</span>: el precio subió<br />
                                  <span className="text-green-300">↓ Verde</span>: el precio bajó<br />
                                  <span className="text-gray-300">Gris</span>: sin cambio<br />
                                  <span className="text-blue-300">Nuevo</span>: no estaba en la factura anterior
                                </span>
                              </span>
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedInvoice.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 text-sm">
                              {item.description}
                              {item.needs_review && (
                                <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                                  Revisar
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">{Math.round(Number(item.quantity))}</td>
                            <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                            <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.total_price)}</td>
                            <td className="px-4 py-3 text-sm text-center">
                              {renderVariacion(item.variacion)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                </div>
              )}

              {selectedInvoice.ocr_text && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                    Ver texto OCR extraído
                  </summary>
                  <pre className="mt-2 p-4 bg-gray-50 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                    {selectedInvoice.ocr_text}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-lg shadow-lg p-4 max-w-sm ${
            notification.type === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-3">
              {notification.type === 'success' ? (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <p className="text-sm font-medium">{notification.message}</p>
              <button
                onClick={() => setNotification(null)}
                className="ml-auto text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
