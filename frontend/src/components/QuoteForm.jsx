import { useState, useEffect } from 'react'
import { getProductCatalog } from '../services/quotesApi'

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(value || 0)

export default function QuoteForm({ onSubmit, initialData, onCancel, loading }) {
  const [clientName, setClientName] = useState(initialData?.client_name || '')
  const [clientRut, setClientRut] = useState(initialData?.client_rut || '')
  const [clientEmail, setClientEmail] = useState(initialData?.client_email || '')
  const [notes, setNotes] = useState(initialData?.notes || '')
  const [validUntil, setValidUntil] = useState(initialData?.valid_until || '')
  const [items, setItems] = useState(
    initialData?.items?.map(i => ({
      product: i.product,
      product_name: i.product_name,
      unit: i.unit,
      stock: null,
      quantity: String(i.quantity),
      unit_price: String(i.unit_price),
    })) || []
  )
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [errors, setErrors] = useState({})

  // Debounce search
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await getProductCatalog(search)
        setSearchResults(res.data?.results || res.data || [])
      } catch { setSearchResults([]) }
      finally { setSearchLoading(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const addItem = (product) => {
    setItems(prev => [...prev, {
      product: product.id,
      product_name: product.name,
      unit: product.unit || 'unidad',
      stock: product.stock,
      quantity: '1',
      unit_price: product.last_price ? String(product.last_price) : '',
    }])
    setSearch('')
    setSearchResults([])
  }

  const updateItem = (index, field, value) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  // Cálculo en tiempo real
  const subtotal = items.reduce((acc, item) => {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unit_price) || 0
    return acc + qty * price
  }, 0)
  const tax = subtotal * 0.19
  const total = subtotal + tax

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}
    if (items.length === 0) newErrors.items = 'Agrega al menos un producto'
    items.forEach((item, i) => {
      if (!parseFloat(item.quantity) || parseFloat(item.quantity) <= 0)
        newErrors[`qty_${i}`] = 'Cantidad inválida'
      if (!parseFloat(item.unit_price) || parseFloat(item.unit_price) <= 0)
        newErrors[`price_${i}`] = 'Precio inválido'
    })
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    setErrors({})
    onSubmit({
      client_name: clientName,
      client_rut: clientRut,
      client_email: clientEmail,
      notes,
      valid_until: validUntil || null,
      items: items.map(item => ({
        product: item.product,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Datos del cliente */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Datos del Cliente</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Nombre</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-400 outline-none"
              placeholder="Nombre del cliente" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">RUT</label>
            <input value={clientRut} onChange={e => setClientRut(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-400 outline-none"
              placeholder="12345678-9" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Email</label>
            <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-400 outline-none"
              placeholder="cliente@email.com" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Válida hasta</label>
            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-400 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Notas</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-400 outline-none"
              placeholder="Observaciones adicionales" />
          </div>
        </div>
      </div>

      {/* Búsqueda de productos */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Productos</h3>
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-100 border-0 border-b-2 border-transparent rounded-lg focus:bg-white focus:border-yellow-500 focus:ring-0 outline-none transition-all text-sm placeholder-gray-400"
            placeholder="Buscar producto por nombre..." />
          {searchLoading && <span className="absolute right-3 top-2.5 text-xs text-gray-400">Buscando...</span>}
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {searchResults.map(p => (
                <button key={p.id} type="button" onClick={() => addItem(p)}
                  className="w-full text-left px-4 py-2.5 hover:bg-yellow-50 text-sm border-b border-gray-100 last:border-0">
                  <span className="font-medium text-gray-900">{p.name}</span>
                  <span className="ml-2 text-xs text-gray-500">{p.unit} · Stock: {p.stock}</span>
                  {p.last_price && <span className="ml-2 text-xs text-yellow-600 font-medium">${Number(p.last_price).toLocaleString('es-CL')}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        {errors.items && <p className="text-red-500 text-xs mt-1">{errors.items}</p>}
      </div>

      {/* Tabla de ítems */}
      {items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-yellow-400">
                <th className="text-left px-4 py-3 font-semibold">Producto</th>
                <th className="text-center px-3 py-3 font-semibold w-28">Cantidad</th>
                <th className="text-center px-3 py-3 font-semibold w-16">Unidad</th>
                <th className="text-right px-3 py-3 font-semibold w-36">Precio Unit.</th>
                <th className="text-right px-3 py-3 font-semibold w-32">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 font-medium">{item.product_name}</td>
                  <td className="px-3 py-3">
                    <input type="number" min="0.001" step="0.001" value={item.quantity}
                      onChange={e => updateItem(i, 'quantity', e.target.value)}
                      className={`w-full text-center px-2 py-1 border rounded-lg text-sm focus:border-yellow-500 outline-none ${errors[`qty_${i}`] ? 'border-red-400' : 'border-gray-300'}`} />
                  </td>
                  <td className="px-3 py-3 text-center text-gray-500 text-xs">{item.unit}</td>
                  <td className="px-3 py-3">
                    <input type="number" min="0.01" step="0.01" value={item.unit_price}
                      onChange={e => updateItem(i, 'unit_price', e.target.value)}
                      className={`w-full text-right px-2 py-1 border rounded-lg text-sm focus:border-yellow-500 outline-none ${errors[`price_${i}`] ? 'border-red-400' : 'border-gray-300'}`} />
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-900">
                    {formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
                  </td>
                  <td className="px-2 py-3 text-center">
                    <button type="button" onClick={() => removeItem(i)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumen financiero */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="w-64 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 flex justify-between text-sm text-gray-700">
              <span>Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="px-4 py-3 flex justify-between text-sm text-gray-700 border-t border-gray-200">
              <span>IVA (19%)</span><span className="font-medium">{formatCurrency(tax)}</span>
            </div>
            <div className="px-4 py-3 flex justify-between bg-gray-900 text-yellow-400">
              <span className="font-bold text-sm">TOTAL CLP</span>
              <span className="font-bold text-sm">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="px-5 py-2.5 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors disabled:opacity-50">
          {loading ? 'Guardando...' : 'Guardar Cotización'}
        </button>
      </div>
    </form>
  )
}
