import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'
import {
  getPriceItems,
  getPriceItem,
  createPriceItem,
  updatePriceItem,
  deletePriceItem,
  createSubItem,
  updateSubItem,
  deleteSubItem,
} from '../services/pricesApi'
import PriceItemForm from '../components/PriceItemForm'
import PriceSubItemForm from '../components/PriceSubItemForm'
import Pagination from '../components/Pagination'

const PAGE_SIZE = 10

function formatCLP(value) {
  const num = Number(value)
  if (isNaN(num)) return '$0'
  return '$' + num.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function Prices() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Modal states
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showSubItemModal, setShowSubItemModal] = useState(false)
  const [editingSubItem, setEditingSubItem] = useState(null)
  const [targetItemId, setTargetItemId] = useState(null)

  // Pagination per item (keyed by item id)
  const [pages, setPages] = useState({})

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getPriceItems()
      const data = res.data?.results ?? res.data ?? []
      // For each item, fetch full details with subitems
      const fullItems = await Promise.all(
        data.map(async (item) => {
          const detail = await getPriceItem(item.id)
          return detail.data
        })
      )
      setItems(fullItems)
    } catch {
      setError('No se pudieron cargar los precios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const showSuccess = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  // --- Item CRUD ---
  const handleCreateItem = async (data) => {
    await createPriceItem(data)
    setShowItemModal(false)
    setEditingItem(null)
    showSuccess('Categoría creada correctamente')
    fetchItems()
  }

  const handleUpdateItem = async (data) => {
    await updatePriceItem(editingItem.id, data)
    setShowItemModal(false)
    setEditingItem(null)
    showSuccess('Categoría actualizada')
    fetchItems()
  }

  const handleDeleteItem = async (item) => {
    const subCount = item.subitems?.length || 0
    const msg = subCount > 0
      ? `¿Eliminar "${item.name}" y sus ${subCount} sub-ítem(s)? Esta acción no se puede deshacer.`
      : `¿Eliminar la categoría "${item.name}"?`
    if (!window.confirm(msg)) return
    try {
      await deletePriceItem(item.id)
      showSuccess('Categoría eliminada')
      fetchItems()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo eliminar')
    }
  }

  // --- SubItem CRUD ---
  const handleCreateSubItem = async (data) => {
    await createSubItem(targetItemId, data)
    setShowSubItemModal(false)
    setTargetItemId(null)
    showSuccess('Sub-ítem agregado correctamente')
    fetchItems()
  }

  const handleUpdateSubItem = async (data) => {
    await updateSubItem(editingSubItem.id, data)
    setShowSubItemModal(false)
    setEditingSubItem(null)
    showSuccess('Sub-ítem actualizado')
    fetchItems()
  }

  const handleDeleteSubItem = async (subItem) => {
    if (!window.confirm(`¿Eliminar "${subItem.description}"?`)) return
    try {
      await deleteSubItem(subItem.id)
      showSuccess('Sub-ítem eliminado')
      fetchItems()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo eliminar')
    }
  }

  // --- Pagination helpers ---
  const getPage = (itemId) => pages[itemId] || 1
  const setPage = (itemId, page) => setPages((prev) => ({ ...prev, [itemId]: page }))

  // Filter items
  const visibleItems = selectedCategory === 'all'
    ? items
    : items.filter((item) => item.id === Number(selectedCategory))

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Precios</h1>
          <p className="text-gray-500 mt-1">Lista de precios de servicios por categoría</p>
        </div>
        <button
          onClick={() => { setEditingItem(null); setShowItemModal(true) }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nuevo Ítem
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

      {/* Filtro por categoría */}
      <div className="max-w-xs">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white"
        >
          <option value="all">Todas las categorías</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.order_number}. {item.name}
            </option>
          ))}
        </select>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <span className="text-5xl mb-3">💰</span>
          <p className="text-sm">No hay ítems de precios registrados</p>
          <p className="text-xs mt-1">Crea tu primera categoría para comenzar</p>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleItems.map((item) => {
            const subitems = item.subitems || []
            const currentPage = getPage(item.id)
            const totalPages = Math.ceil(subitems.length / PAGE_SIZE)
            const paginatedSubs = subitems.slice(
              (currentPage - 1) * PAGE_SIZE,
              currentPage * PAGE_SIZE
            )

            return (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Item header */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-gray-900">
                  <h2 className="text-lg font-bold text-yellow-400">
                    {item.order_number}. {item.name}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setTargetItemId(item.id); setEditingSubItem(null); setShowSubItemModal(true) }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
                      title="Agregar Sub-Ítem"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      Sub-Ítem
                    </button>
                    <button
                      onClick={() => { setEditingItem(item); setShowItemModal(true) }}
                      className="p-1.5 text-gray-400 hover:text-yellow-400 transition-colors"
                      title="Editar categoría"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item)}
                      className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                      title="Eliminar categoría"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sub-items table */}
                {subitems.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-400 text-sm">
                    Sin sub-ítems. Agrega el primero.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-4 sm:px-6 py-3 font-semibold text-gray-600 w-20">N°</th>
                            <th className="text-left px-4 py-3 font-semibold text-gray-600">Descripción</th>
                            <th className="text-right px-4 py-3 font-semibold text-gray-600 w-36">Valor Neto</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-600 w-24">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {paginatedSubs.map((sub) => (
                            <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 sm:px-6 py-3 font-mono text-xs text-gray-500">
                                {sub.full_number}
                              </td>
                              <td className="px-4 py-3 text-gray-900">{sub.description}</td>
                              <td className="px-4 py-3 text-right font-medium text-gray-900">
                                {formatCLP(sub.net_value)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => { setEditingSubItem(sub); setTargetItemId(null); setShowSubItemModal(true) }}
                                    className="p-1.5 text-gray-400 hover:text-yellow-600 transition-colors"
                                    title="Editar"
                                  >
                                    <PencilIcon className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSubItem(sub)}
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
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={(page) => setPage(item.id, page)}
                      totalItems={subitems.length}
                      pageSize={PAGE_SIZE}
                    />
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Crear/Editar Ítem */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-8 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingItem ? 'Editar Categoría' : 'Nueva Categoría'}
              </h2>
              <button
                onClick={() => { setShowItemModal(false); setEditingItem(null) }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <PriceItemForm
                item={editingItem}
                onSave={editingItem ? handleUpdateItem : handleCreateItem}
                onCancel={() => { setShowItemModal(false); setEditingItem(null) }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear/Editar Sub-Ítem */}
      {showSubItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-8 animate-fade-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingSubItem ? 'Editar Sub-Ítem' : 'Agregar Sub-Ítem'}
              </h2>
              <button
                onClick={() => { setShowSubItemModal(false); setEditingSubItem(null); setTargetItemId(null) }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <PriceSubItemForm
                subItem={editingSubItem}
                onSave={editingSubItem ? handleUpdateSubItem : handleCreateSubItem}
                onCancel={() => { setShowSubItemModal(false); setEditingSubItem(null); setTargetItemId(null) }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
