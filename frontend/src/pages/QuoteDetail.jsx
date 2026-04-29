import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getQuote, updateQuote, changeQuoteStatus, downloadQuotePdf } from '../services/quotesApi'
import QuoteStatusBadge from '../components/QuoteStatusBadge'
import QuoteForm from '../components/QuoteForm'

// Transiciones permitidas por estado
const ALLOWED_TRANSITIONS = {
  draft:    ['sent'],
  sent:     ['approved', 'rejected'],
  approved: [],
  rejected: [],
}

const STATUS_LABELS = {
  sent:     'Marcar como Enviada',
  approved: 'Aprobar',
  rejected: 'Rechazar',
}

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(value || 0)

export default function QuoteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const fetchQuote = async () => {
    setLoading(true)
    try {
      const res = await getQuote(id)
      setQuote(res.data)
    } catch {
      setError('No se pudo cargar la cotización')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuote()
  }, [id])

  const handleStatusChange = async (newStatus) => {
    setError('')
    try {
      await changeQuoteStatus(id, newStatus)
      await fetchQuote()
      setSuccessMsg('Estado actualizado correctamente')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Error al cambiar el estado')
    }
  }

  const handleEdit = async (data) => {
    setSaving(true)
    setError('')
    try {
      await updateQuote(id, data)
      setShowEditModal(false)
      await fetchQuote()
      setSuccessMsg('Cotización actualizada')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPdf = async () => {
    setDownloading(true)
    setError('')
    try {
      const res = await downloadQuotePdf(id)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${quote.quote_number}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Error al generar el PDF'
      setError(msg)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Cargando cotización...
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">{error || 'Cotización no encontrada'}</p>
        <button onClick={() => navigate('/cotizaciones')} className="mt-4 text-yellow-600 hover:underline text-sm">
          Volver al listado
        </button>
      </div>
    )
  }

  const allowedNext = ALLOWED_TRANSITIONS[quote.status] || []

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back + header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/cotizaciones')}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{quote.quote_number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <QuoteStatusBadge status={quote.status} />
              {quote.valid_until && (
                <span className="text-xs text-gray-500">
                  Válida hasta {format(new Date(quote.valid_until + 'T00:00:00'), 'dd/MM/yyyy', { locale: es })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2">
          {quote.status === 'draft' && (
            <button
              onClick={() => setShowEditModal(true)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Editar
            </button>
          )}
          {allowedNext.map(nextStatus => (
            <button
              key={nextStatus}
              onClick={() => handleStatusChange(nextStatus)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
                nextStatus === 'rejected'
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : nextStatus === 'approved'
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              {STATUS_LABELS[nextStatus] || nextStatus}
            </button>
          ))}
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="px-4 py-2 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {downloading ? 'Generando...' : 'Descargar PDF'}
          </button>
        </div>
      </div>

      {/* Mensajes */}
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

      {/* Datos del cliente */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Datos del Cliente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Nombre</p>
            <p className="text-gray-900">{quote.client_name || <span className="text-gray-400 italic">Sin nombre</span>}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">RUT</p>
            <p className="text-gray-900">{quote.client_rut || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Email</p>
            <p className="text-gray-900">{quote.client_email || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Creada</p>
            <p className="text-gray-900">
              {quote.created_at ? format(new Date(quote.created_at), 'dd/MM/yyyy HH:mm', { locale: es }) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Última actualización</p>
            <p className="text-gray-900">
              {quote.updated_at ? format(new Date(quote.updated_at), 'dd/MM/yyyy HH:mm', { locale: es }) : '—'}
            </p>
          </div>
          {quote.notes && (
            <div className="sm:col-span-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Notas</p>
              <p className="text-gray-700">{quote.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Ítems */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Productos</h2>
        </div>
        {quote.items && quote.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-yellow-400">
                  <th className="text-left px-6 py-3 font-semibold">Producto</th>
                  <th className="text-center px-4 py-3 font-semibold">Cantidad</th>
                  <th className="text-center px-4 py-3 font-semibold">Unidad</th>
                  <th className="text-right px-4 py-3 font-semibold">Precio Unit.</th>
                  <th className="text-right px-6 py-3 font-semibold">Total línea</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quote.items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{item.product_name}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{Number(item.quantity)}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{item.unit}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.unit_price)}</td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 py-8 text-center text-gray-400">Sin ítems</p>
        )}
      </div>

      {/* Resumen financiero */}
      <div className="flex justify-end">
        <div className="w-72 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 flex justify-between text-sm text-gray-700">
            <span>Subtotal</span>
            <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
          </div>
          <div className="px-5 py-3 flex justify-between text-sm text-gray-700 border-t border-gray-100">
            <span>IVA (19%)</span>
            <span className="font-medium">{formatCurrency(quote.tax_amount)}</span>
          </div>
          <div className="px-5 py-4 flex justify-between bg-gray-900 text-yellow-400">
            <span className="font-bold">TOTAL CLP</span>
            <span className="font-bold">{formatCurrency(quote.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Modal de edición */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl my-8 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Editar Cotización</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <QuoteForm
                initialData={quote}
                onSubmit={handleEdit}
                onCancel={() => setShowEditModal(false)}
                loading={saving}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
