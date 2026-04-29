import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getQuotes, createQuote } from '../services/quotesApi'
import QuoteStatusBadge from '../components/QuoteStatusBadge'
import QuoteForm from '../components/QuoteForm'
import Pagination from '../components/Pagination'

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
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const fetchQuotes = async (status = statusFilter, page = currentPage) => {
    setLoading(true)
    try {
      const res = await getQuotes(status, page)
      const data = res.data
      if (Array.isArray(data)) {
        setQuotes(data)
        setTotalCount(data.length)
      } else {
        setQuotes(data.results || [])
        setTotalCount(data.count || 0)
      }
    } catch {
      setQuotes([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuotes(statusFilter, currentPage)
  }, [statusFilter, currentPage])

  const handleStatusFilter = (value) => {
    setStatusFilter(value)
    setCurrentPage(1)
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

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
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold px-4 py-2.5 rounded-lg transition-colors self-start sm:self-auto"
        >
          <PlusIcon className="w-5 h-5" />
          Nueva Cotización
        </button>
      </div>

      {/* Filtro por estado */}
      <div className="flex flex-wrap gap-2">
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
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-yellow-400">
                <th className="text-left px-6 py-3 font-semibold">N° Cotización</th>
                <th className="text-left px-6 py-3 font-semibold">Cliente</th>
                <th className="text-left px-6 py-3 font-semibold">Estado</th>
                <th className="text-right px-6 py-3 font-semibold">Total</th>
                <th className="text-left px-6 py-3 font-semibold">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-gray-400">Cargando...</td>
                </tr>
              ) : quotes.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <p className="text-gray-400 text-base">No hay cotizaciones{statusFilter ? ' con ese estado' : ''}</p>
                    <button
                      onClick={() => setShowModal(true)}
                      className="mt-3 text-yellow-600 hover:text-yellow-700 font-medium text-sm"
                    >
                      Crear la primera cotización
                    </button>
                  </td>
                </tr>
              ) : (
                quotes.map(quote => (
                  <tr
                    key={quote.id}
                    onClick={() => navigate(`/cotizaciones/${quote.id}`)}
                    className="hover:bg-yellow-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 font-semibold text-gray-900">{quote.quote_number}</td>
                    <td className="px-6 py-4 text-gray-700">{quote.client_name || <span className="text-gray-400 italic">Sin nombre</span>}</td>
                    <td className="px-6 py-4">
                      <QuoteStatusBadge status={quote.status} />
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900">
                      {formatCurrency(quote.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {quote.created_at
                        ? format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: es })
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          totalItems={totalCount}
          pageSize={PAGE_SIZE}
        />
      </div>

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
