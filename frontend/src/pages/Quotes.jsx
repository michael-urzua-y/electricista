import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusIcon, XMarkIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getQuotes, createQuote } from '../services/quotesApi'
import QuoteStatusBadge from '../components/QuoteStatusBadge'
import QuoteForm from '../components/QuoteForm'
import Pagination from '../components/Pagination'
import MonthPicker from '../components/MonthPicker'

const PAGE_SIZE = 10

const STATUS_OPTIONS = [
  { value: '',         label: 'Todos' },
  { value: 'draft',    label: 'Borrador' },
  { value: 'sent',     label: 'Enviada' },
  { value: 'approved', label: 'Aprobada' },
  { value: 'rejected', label: 'Rechazada' },
]

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(value || 0)

export default function Quotes() {
  const navigate = useNavigate()
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [pages, setPages] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')

  const fetchQuotes = async (status = statusFilter) => {
    setLoading(true)
    try {
      const res = await getQuotes(status)
      const data = res.data
      if (Array.isArray(data)) {
        setQuotes(data)
      } else {
        setQuotes(data.results || [])
      }
    } catch {
      setQuotes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuotes(statusFilter)
  }, [statusFilter])

  const handleStatusFilter = (value) => {
    setStatusFilter(value)
    setPages({})
  }

  // Compute available months from quotes data
  const availableMonths = useMemo(() => {
    const set = new Set()
    quotes.forEach(q => {
      const dateField = q.created_at
      if (dateField) {
        const [y, m] = dateField.substring(0, 7).split('-')
        set.add(JSON.stringify({ year: parseInt(y), month: parseInt(m) }))
      }
    })
    return [...set].map(s => JSON.parse(s))
  }, [quotes])

  // Filter quotes by selected period
  const filteredQuotes = useMemo(() => {
    if (!selectedPeriod) return quotes
    return quotes.filter(q => {
      const dateField = q.created_at
      if (!dateField) return false
      const [y, m] = dateField.substring(0, 7).split('-')
      return parseInt(y) === selectedPeriod.year && parseInt(m) === selectedPeriod.month
    })
  }, [quotes, selectedPeriod])

  const handleCreate = async (data) => {
    setSaving(true)
    setError('')
    try {
      const res = await createQuote(data)
      setShowModal(false)
      navigate(`/cotizaciones/${res.data.id}`)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear la cotización')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-gray-500 mt-1">Gestiona tus cotizaciones de servicios y materiales</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={() => navigate('/clients')}
            className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium px-4 py-2.5 rounded-lg transition-colors text-sm"
          >
            <UserGroupIcon className="w-4 h-4" />
            Clientes
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold px-4 py-2.5 rounded-lg transition-colors text-sm"
          >
            <PlusIcon className="w-5 h-5" />
            Nueva Cotización
          </button>
        </div>
      </div>

      {/* Filtro por estado */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleStatusFilter(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? 'bg-gray-900 text-yellow-400'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
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
      </div>

      {/* Cotizaciones agrupadas por mes */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <span className="text-5xl mb-3">📋</span>
          <p className="text-sm">No hay cotizaciones{statusFilter ? ' con ese estado' : ''}{selectedPeriod ? ' en este período' : ''}</p>
          {selectedPeriod ? (
            <button
              onClick={() => setSelectedPeriod(null)}
              className="mt-3 text-yellow-600 hover:text-yellow-700 font-medium text-sm"
            >
              Ver todos los meses
            </button>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 text-yellow-600 hover:text-yellow-700 font-medium text-sm"
            >
              Crear la primera cotización
            </button>
          )}
        </div>
      ) : (() => {
        const groups = {}
        filteredQuotes.forEach((q) => {
          const key = q.created_at ? q.created_at.substring(0, 7) : 'sin-fecha'
          if (!groups[key]) groups[key] = []
          groups[key].push(q)
        })
        const sortedMonths = Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        const fmtMonth = (ym) => {
          if (ym === 'sin-fecha') return 'Sin fecha'
          const [year, month] = ym.split('-')
          return `${monthNames[parseInt(month, 10) - 1]} ${year}`
        }

        return (
          <div className="space-y-6">
            {sortedMonths.map(([month, monthQuotes]) => {
              const subtotal = monthQuotes.reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0)
              const page = pages[month] || 1
              const totalPages = Math.ceil(monthQuotes.length / PAGE_SIZE)
              const paginated = monthQuotes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

              return (
                <div key={month} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Month header */}
                  <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-gray-900">
                    <h2 className="text-lg font-bold text-yellow-400">
                      {fmtMonth(month)}
                    </h2>
                    <div className="flex items-center gap-4">
                      <span className="text-white text-sm font-medium hidden sm:inline">
                        {monthQuotes.length} cotización(es)
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
                          <th className="text-left px-4 sm:px-6 py-3 font-semibold text-gray-600">N° Cotización</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                          <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Fecha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginated.map(quote => (
                          <tr
                            key={quote.id}
                            onClick={() => navigate(`/cotizaciones/${quote.id}`)}
                            className="hover:bg-yellow-50 cursor-pointer transition-colors"
                          >
                            <td className="px-4 sm:px-6 py-3 font-semibold text-gray-900">{quote.quote_number}</td>
                            <td className="px-4 py-3 text-gray-700">{quote.client_name || <span className="text-gray-400 italic">Sin nombre</span>}</td>
                            <td className="px-4 py-3 text-center">
                              <QuoteStatusBadge status={quote.status} />
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">
                              {formatCurrency(quote.total_amount)}
                            </td>
                            <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                              {quote.created_at
                                ? format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: es })
                                : '—'}
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
                    totalItems={monthQuotes.length}
                    pageSize={PAGE_SIZE}
                  />
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Modal Nueva Cotización */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl my-8 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Nueva Cotización</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                  {error}
                </div>
              )}
              <QuoteForm
                onSubmit={handleCreate}
                onCancel={() => setShowModal(false)}
                loading={saving}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
