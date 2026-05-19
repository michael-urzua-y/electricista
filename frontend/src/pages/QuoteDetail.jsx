import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, XMarkIcon, EnvelopeIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getQuote, updateQuote, changeQuoteStatus, downloadQuotePdf } from '../services/quotesApi'
import api from '../services/api'
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

  // Email state
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailLogs, setEmailLogs] = useState([])
  const [emailLogsLoading, setEmailLogsLoading] = useState(false)

  const fetchQuote = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getQuote(id)
      setQuote(res.data)
    } catch {
      setError('No se pudo cargar la cotización')
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchEmailLogs = useCallback(async () => {
    setEmailLogsLoading(true)
    try {
      const res = await api.get(`/cotizaciones/${id}/email-logs/`)
      const data = res.data?.results ?? res.data ?? []
      setEmailLogs(Array.isArray(data) ? data : [])
    } catch {
      // silently ignore
    } finally {
      setEmailLogsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchQuote()
    fetchEmailLogs()
  }, [fetchQuote, fetchEmailLogs])

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

  const handleSendEmail = async () => {
    setSendingEmail(true)
    setError('')
    try {
      await api.post(`/cotizaciones/${id}/send-email/`)
      setShowEmailModal(false)
      setSuccessMsg('Email enviado correctamente')
      setTimeout(() => setSuccessMsg(''), 5000)
      await fetchQuote()
      await fetchEmailLogs()
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Error al enviar el email'
      setError(msg)
      setShowEmailModal(false)
    } finally {
      setSendingEmail(false)
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
          {(quote.status === 'draft' || quote.status === 'sent') && (
            <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <EnvelopeIcon className="w-4 h-4" />
              Enviar por Email
            </button>
          )}
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
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Ítems</h2>
        </div>
        {quote.items && quote.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-yellow-400">
                  <th className="text-left px-6 py-3 font-semibold">Descripción</th>
                  <th className="text-center px-4 py-3 font-semibold">Cantidad</th>
                  <th className="text-right px-4 py-3 font-semibold">Precio Unitario</th>
                  <th className="text-right px-6 py-3 font-semibold">Total Línea</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  const grouped = []
                  let currentGroup = null
                  quote.items.forEach(item => {
                    const groupName = item.item_name || 'Otros'
                    if (groupName !== currentGroup) {
                      currentGroup = groupName
                      grouped.push({ type: 'header', name: groupName, key: `h-${groupName}-${item.id}` })
                    }
                    grouped.push({ type: 'item', data: item, key: `i-${item.id}` })
                  })
                  return grouped.map(row => {
                    if (row.type === 'header') {
                      return (
                        <tr key={row.key} className="bg-gray-100">
                          <td colSpan={4} className="px-6 py-2 font-bold text-gray-700 text-xs uppercase tracking-wide">
                            {row.name}
                          </td>
                        </tr>
                      )
                    }
                    return (
                      <tr key={row.key} className="hover:bg-gray-50">
                        <td className="px-6 py-3 pl-10 font-medium text-gray-900">{row.data.description}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{Number(row.data.quantity)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.data.unit_price)}</td>
                        <td className="px-6 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.data.line_total)}</td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 py-8 text-center text-gray-400">Sin ítems</p>
        )}
      </div>

      {/* Resumen financiero */}
      <div className="flex justify-end">
        <div className="w-80 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 flex justify-between text-sm text-gray-700">
            <span>Subtotal</span>
            <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
          </div>
          {Number(quote.discount_percentage) !== 0 && (
            <div className="px-5 py-3 flex justify-between text-sm text-gray-700 border-t border-gray-100">
              <span>Descuento ({Number(quote.discount_percentage)}%)</span>
              <span className="font-medium text-red-600">-{formatCurrency(quote.discount_amount)}</span>
            </div>
          )}
          <div className="px-5 py-3 flex justify-between text-sm text-gray-700 border-t border-gray-100">
            <span>Total</span>
            <span className="font-medium">{formatCurrency(quote.total)}</span>
          </div>
          <div className="px-5 py-3 flex justify-between text-sm text-gray-700 border-t border-gray-100">
            <span>IVA (19%)</span>
            <span className="font-medium">{formatCurrency(quote.tax_amount)}</span>
          </div>
          <div className="px-5 py-4 flex justify-between bg-gray-900 text-yellow-400">
            <span className="font-bold">TOTAL NETO</span>
            <span className="font-bold">{formatCurrency(quote.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Historial de Envíos */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
            <EnvelopeIcon className="w-4 h-4 text-gray-400" />
            Historial de Envíos
          </h2>
        </div>
        {emailLogsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-500" />
          </div>
        ) : emailLogs.length === 0 ? (
          <p className="px-6 py-6 text-center text-gray-400 text-sm">Sin envíos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha / Hora</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Destinatario</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {emailLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-700">
                      {log.sent_at
                        ? format(new Date(log.sent_at), 'dd/MM/yyyy HH:mm', { locale: es })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{log.recipient || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {log.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                          <CheckCircleIcon className="w-4 h-4" /> Exitoso
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                          <XCircleIcon className="w-4 h-4" /> Fallido
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      {/* Modal de envío por email */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Enviar Cotización por Email</h2>
              <button
                onClick={() => setShowEmailModal(false)}
                disabled={sendingEmail}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700">
                Se enviará la cotización <span className="font-semibold">{quote.quote_number}</span> en formato PDF al siguiente destinatario:
              </p>
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <EnvelopeIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <span className="text-sm font-medium text-blue-800">
                  {quote.client_email || <span className="italic text-red-500">Sin email registrado</span>}
                </span>
              </div>
              {!quote.client_email && (
                <p className="text-xs text-red-500">
                  Esta cotización no tiene email de cliente. Edítala para agregar uno antes de enviar.
                </p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowEmailModal(false)}
                  disabled={sendingEmail}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !quote.client_email}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {sendingEmail ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <EnvelopeIcon className="w-4 h-4" />
                      Confirmar envío
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
