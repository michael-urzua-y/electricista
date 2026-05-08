import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { getClient, updateClient, getClientQuotes, getClientStats } from '../services/clientsApi'
import ClientForm from '../components/ClientForm'
import QuoteStatusBadge from '../components/QuoteStatusBadge'

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(value || 0)

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [client, setClient] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [clientRes, quotesRes, statsRes] = await Promise.all([
        getClient(id),
        getClientQuotes(id),
        getClientStats(id),
      ])
      setClient(clientRes.data)
      const qData = quotesRes.data?.results ?? quotesRes.data ?? []
      setQuotes(Array.isArray(qData) ? qData : [])
      setStats(statsRes.data)
    } catch {
      setError('No se pudo cargar la información del cliente')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleEdit = async (data) => {
    try {
      await updateClient(id, data)
      setShowEditModal(false)
      setSuccessMsg('Cliente actualizado correctamente')
      setTimeout(() => setSuccessMsg(''), 4000)
      fetchAll()
    } catch (err) {
      const d = err.response?.data
      const msg = d ? Object.values(d).flat().join(' ') : 'Error al actualizar el cliente'
      setError(msg)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Cargando cliente...
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">{error || 'Cliente no encontrado'}</p>
        <button onClick={() => navigate('/clients')} className="mt-4 text-yellow-600 hover:underline text-sm">
          Volver al listado
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/clients')}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                client.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {client.is_active ? 'Activo' : 'Inactivo'}
              </span>
              <span className="text-xs text-gray-400 font-mono">{client.rut}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowEditModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <PencilSquareIcon className="w-4 h-4" />
          Editar
        </button>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}
      {successMsg && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{successMsg}</div>
      )}

      {/* Ficha del cliente */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Datos del Cliente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">RUT</p>
            <p className="text-gray-900 font-mono">{client.rut}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Email</p>
            <p className="text-gray-900">{client.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Teléfono</p>
            <p className="text-gray-900">{client.phone || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Dirección</p>
            <p className="text-gray-900">{client.address || '—'}</p>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Total comprado (aprobado)</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.total_approved)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Top 5 productos</p>
            {stats.top_products && stats.top_products.length > 0 ? (
              <ol className="space-y-1">
                {stats.top_products.map((p, i) => (
                  <li key={p.product_name} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="truncate">{p.product_name}</span>
                    <span className="ml-auto text-xs text-gray-400 flex-shrink-0">×{p.count}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-gray-400">Sin datos</p>
            )}
          </div>
        </div>
      )}

      {/* Historial de cotizaciones */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Historial de Cotizaciones</h2>
        </div>
        {quotes.length === 0 ? (
          <p className="px-6 py-8 text-center text-gray-400 text-sm">Sin cotizaciones registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Número</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotes.map(q => (
                  <tr
                    key={q.id}
                    onClick={() => navigate(`/cotizaciones/${q.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 font-medium text-gray-900">{q.quote_number}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {q.created_at
                        ? format(new Date(q.created_at), 'dd/MM/yyyy', { locale: es })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <QuoteStatusBadge status={q.status} />
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(q.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal edición */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-8 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Editar Cliente</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <ClientForm
                client={client}
                onSave={handleEdit}
                onCancel={() => setShowEditModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
