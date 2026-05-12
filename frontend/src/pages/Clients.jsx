import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon, PlusIcon, XMarkIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { getClients, createClient, deactivateClient, getInactiveClients } from '../services/clientsApi'
import ClientForm from '../components/ClientForm'

export default function Clients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [inactiveCount, setInactiveCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const debounceRef = useRef(null)

  const fetchClients = useCallback(async (q = '') => {
    setLoading(true)
    setError('')
    try {
      const params = q.length >= 2 ? { q } : {}
      const res = await getClients(params)
      const data = res.data?.results ?? res.data ?? []
      setClients(Array.isArray(data) ? data : [])
    } catch {
      setError('No se pudieron cargar los clientes')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchInactiveCount = useCallback(async () => {
    try {
      const res = await getInactiveClients()
      const data = res.data?.results ?? res.data ?? []
      setInactiveCount(Array.isArray(data) ? data.length : 0)
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => {
    fetchClients()
    fetchInactiveCount()
  }, [fetchClients, fetchInactiveCount])

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchClients(val)
    }, 300)
  }

  const handleCreate = async (data) => {
    await createClient(data)
    setShowModal(false)
    setSuccessMsg('Cliente creado correctamente')
    setTimeout(() => setSuccessMsg(''), 4000)
    fetchClients(search)
    fetchInactiveCount()
  }

  const handleDeactivate = async (client, e) => {
    e.stopPropagation()
    if (!window.confirm(`¿Desactivar al cliente "${client.name}"? Esta acción no elimina su historial.`)) return
    try {
      await deactivateClient(client.id)
      setSuccessMsg('Cliente desactivado')
      setTimeout(() => setSuccessMsg(''), 4000)
      fetchClients(search)
      fetchInactiveCount()
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'No se pudo desactivar el cliente'
      setError(msg)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              Clientes
              {inactiveCount > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-orange-100 text-orange-700 rounded-full border border-orange-200">
                  {inactiveCount} inactivo{inactiveCount !== 1 ? 's' : ''}
                </span>
              )}
            </h1>
            <p className="text-gray-500 mt-1">Gestión de clientes y su historial</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nuevo Cliente
        </button>
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

      {/* Búsqueda */}
      <div className="relative max-w-md">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={handleSearchChange}
          placeholder="Buscar por nombre, RUT o email (mín. 2 caracteres)..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <UserGroupIcon className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-sm">
              {search.length >= 2 ? 'No se encontraron clientes con esa búsqueda' : 'No hay clientes registrados'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-yellow-400">
                  <th className="text-left px-4 sm:px-6 py-3 font-semibold">Nombre</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">RUT</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Email</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Teléfono</th>
                  <th className="text-center px-4 py-3 font-semibold">Estado</th>
                  <th className="text-center px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map(client => (
                  <tr
                    key={client.id}
                    onClick={() => navigate(`/clients/${client.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 sm:px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{client.name}</p>
                        <p className="text-xs text-gray-500 sm:hidden">{client.rut}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-600 font-mono text-xs hidden sm:table-cell">{client.rut}</td>
                    <td className="px-4 py-4 text-gray-600 hidden md:table-cell">{client.email || '—'}</td>
                    <td className="px-4 py-4 text-gray-600 hidden lg:table-cell">{client.phone || '—'}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        client.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {client.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {client.is_active && (
                        <button
                          onClick={(e) => handleDeactivate(client, e)}
                          className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          Desactivar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal nuevo cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-8 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Nuevo Cliente</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <ClientForm
                client={null}
                onSave={handleCreate}
                onCancel={() => setShowModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
