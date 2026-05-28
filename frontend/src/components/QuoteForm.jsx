import { useState, useEffect, useRef, useCallback } from 'react'
import { getPriceItems, getSubItems } from '../services/pricesApi'
import { getClients } from '../services/clientsApi'
import { formatRut, validateRut } from '../utils/rutUtils'
import { IVA_PERCENT_LABEL, IVA_RATE } from '../config/appConfig'

const formatCLP = (value) => {
  const num = Number(value)
  if (Number.isNaN(num)) return '$0'
  return '$' + num.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const formatNumberWithThousands = (value) => {
  if (!value && value !== 0) return ''
  const num = parseFloat(String(value).replace(',', '.'))
  if (Number.isNaN(num)) return ''
  return num.toLocaleString('es-CL')
}

const parseNumberFromThousands = (value) => {
  if (!value) return ''
  const normalized = String(value).replace(/\./g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return Number.isNaN(num) ? '' : num.toString()
}

export default function QuoteForm({ onSubmit, initialData, onCancel, loading }) {
  // Client fields
  const [clientName, setClientName] = useState(initialData?.client_name || '')
  const [clientRut, setClientRut] = useState(initialData?.client_rut || '')
  const [clientEmail, setClientEmail] = useState(initialData?.client_email || '')
  const [notes, setNotes] = useState(initialData?.notes || '')
  const [validUntil, setValidUntil] = useState(initialData?.valid_until || '')

  // Quote items (lines)
  const [items, setItems] = useState(
    initialData?.items?.map(i => ({
      price_sub_item: i.price_sub_item,
      description: i.description,
      quantity: String(i.quantity),
      unit_price: String(i.unit_price),
    })) || []
  )

  // Discount
  const [discountPercentage, setDiscountPercentage] = useState(
    initialData?.discount_percentage != null ? String(initialData.discount_percentage) : '0'
  )

  // Category selector state
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categorySubItems, setCategorySubItems] = useState([])
  const [categoryLoading, setCategoryLoading] = useState(false)
  const categoryRef = useRef(null)

  // Client search state
  const [clientSearch, setClientSearch] = useState('')
  const [clientResults, setClientResults] = useState([])
  const [clientSearchLoading, setClientSearchLoading] = useState(false)
  const [showClientDropdown, setShowClientDropdown] = useState(false)
  const clientDropdownRef = useRef(null)

  // Errors
  const [errors, setErrors] = useState({})
  const [rutError, setRutError] = useState('')

  // --- Load categories on mount ---
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await getPriceItems()
        const data = res.data?.results ?? res.data ?? []
        setCategories(data)
      } catch {
        setCategories([])
      }
    }
    fetchCategories()
  }, [])

  // --- Load sub-items when category changes ---
  useEffect(() => {
    if (!selectedCategory) {
      setCategorySubItems([])
      return
    }
    const fetchSubItems = async () => {
      setCategoryLoading(true)
      try {
        const res = await getSubItems(selectedCategory)
        const data = res.data?.results ?? res.data ?? []
        setCategorySubItems(data)
      } catch {
        setCategorySubItems([])
      } finally {
        setCategoryLoading(false)
      }
    }
    fetchSubItems()
  }, [selectedCategory])

  // --- Close category dropdown on click outside ---
  useEffect(() => {
    const handler = (e) => {
      if (selectedCategory && categoryRef.current && !categoryRef.current.contains(e.target)) {
        setSelectedCategory('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [selectedCategory])

  // --- Client search with debounce ---
  useEffect(() => {
    if (!clientSearch.trim() || clientSearch.trim().length < 2) {
      setClientResults([])
      setShowClientDropdown(false)
      return
    }
    const timer = setTimeout(async () => {
      setClientSearchLoading(true)
      try {
        const res = await getClients({ q: clientSearch.trim() })
        const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
        setClientResults(data)
        setShowClientDropdown(data.length > 0)
      } catch {
        setClientResults([])
      } finally {
        setClientSearchLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [clientSearch])

  // Close client dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target)) {
        setShowClientDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelectClient = (client) => {
    setClientName(client.name)
    setClientRut(client.rut)
    setClientEmail(client.email || '')
    setClientSearch('')
    setClientResults([])
    setShowClientDropdown(false)
  }

// --- Add item from PriceSubItem ---
   const addItemFromSubItem = useCallback((subItem) => {
     setItems(prev => [...prev, {
       price_sub_item: subItem.id,
       description: subItem.description,
       quantity: '1',
       unit_price: String(parseFloat(subItem.net_value) || 0),
     }])
   }, [])

   // --- Add extra expense (manual line) ---
   const addExtraExpense = () => {
     setItems(prev => [...prev, {
       price_sub_item: null,
       description: '',
       quantity: '1',
       unit_price: '0',
     }])
   }

   // --- Update item field ---
   const updateItem = (index, field, value) => {
     setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
   }

   // --- Remove item ---
   const removeItem = (index) => {
     setItems(prev => prev.filter((_, i) => i !== index))
   }

  // --- Financial calculations ---
  const subtotal = items.reduce((acc, item) => {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unit_price) || 0
    return acc + qty * price
  }, 0)

  const discountPct = parseFloat(discountPercentage) || 0
  const discountAmount = subtotal * (discountPct / 100)
  const total = subtotal - discountAmount
  const taxAmount = total * IVA_RATE
  const totalAmount = total + taxAmount

  // --- Validation ---
  const isDiscountValid = discountPct >= 0 && discountPct <= 100
  const discountRaw = discountPercentage.trim()
  const isDiscountFieldValid = discountRaw === '' || (isDiscountValid && !Number.isNaN(parseFloat(discountRaw)))

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}

    if (items.length === 0) newErrors.items = 'Agrega al menos un ítem'

    items.forEach((item, i) => {
      const qty = parseFloat(item.quantity)
      if (!qty || qty <= 0) newErrors[`qty_${i}`] = 'Cantidad inválida'
      const price = parseFloat(item.unit_price)
      if (price === undefined || price === null || Number.isNaN(price) || price < 0) {
        newErrors[`price_${i}`] = 'Precio inválido'
      }
    })

    if (!isDiscountFieldValid || !isDiscountValid) {
      newErrors.discount = 'El descuento debe estar entre 0 y 100'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

setErrors({})
     onSubmit({
       client_name: clientName,
       client_rut: clientRut,
       client_email: clientEmail,
       notes,
       valid_until: validUntil || null,
       discount_percentage: discountPct,
       items: items.map(item => ({
         price_sub_item: item.price_sub_item,
         quantity: parseFloat(item.quantity),
         unit_price: parseFloat(item.unit_price),
         description: item.description,
       })),
     })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Datos del cliente */}
      <div className="bg-gray-50 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Datos del Cliente</h3>

        {/* Buscador de clientes guardados */}
        <div ref={clientDropdownRef} className="relative">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
            Buscar cliente guardado
          </label>
          <div className="relative">
            <input
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              onFocus={() => clientResults.length > 0 && setShowClientDropdown(true)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-400 outline-none pr-8"
              placeholder="Buscar por nombre, RUT o email..."
              autoComplete="off"
            />
            {clientSearchLoading && (
              <span className="absolute right-3 top-2.5 text-xs text-gray-400">...</span>
            )}
          </div>
          {showClientDropdown && clientResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
              {clientResults.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectClient(c)}
                  className="w-full text-left px-4 py-2.5 hover:bg-yellow-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.rut}{c.email ? ` · ${c.email}` : ''}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Nombre</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-400 outline-none"
              placeholder="Nombre del cliente" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">RUT</label>
            <input value={clientRut} onChange={e => {
              const formatted = formatRut(e.target.value)
              setClientRut(formatted)
              if (formatted.length > 3 && !validateRut(formatted)) {
                setRutError('RUT inválido')
              } else {
                setRutError('')
              }
            }}
              onBlur={() => {
                if (clientRut && !validateRut(clientRut)) setRutError('RUT inválido')
              }}
              maxLength={12}
              className={`w-full px-3 py-2 bg-white border rounded-lg text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-400 outline-none ${rutError ? 'border-red-400' : 'border-gray-300'}`}
              placeholder="12.345.678-9" />
            {rutError && <p className="mt-1 text-xs text-red-500">{rutError}</p>}
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
              min={new Date().toISOString().split('T')[0]}
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

{/* Agregar ítems — Selector de categoría + Buscador */}
       <div className="space-y-4">
         <div className="flex items-center justify-between">
           <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Agregar Ítems</h3>
           <button
             type="button"
             onClick={addExtraExpense}
             className="px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-300 rounded-lg hover:bg-yellow-100 transition-colors flex items-center gap-1"
           >
             <span>+</span>
             Gasto Extra
           </button>
         </div>

         <div className="grid grid-cols-1 gap-4">
           {/* Selector de categoría */}
           <div ref={categoryRef}>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Seleccionar por categoría
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-400 outline-none"
            >
              <option value="">— Seleccionar categoría —</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.order_number}. {cat.name}
                </option>
              ))}
            </select>

            {/* Sub-items de la categoría seleccionada */}
            {selectedCategory && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                {categoryLoading ? (
                  <div className="px-4 py-3 text-sm text-gray-400">Cargando...</div>
                ) : categorySubItems.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">Sin sub-ítems en esta categoría</div>
                ) : (
                  categorySubItems.map(sub => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => addItemFromSubItem(sub)}
                      className="w-full text-left px-4 py-2.5 hover:bg-yellow-50 transition-colors border-b border-gray-100 last:border-0 flex items-center justify-between"
                    >
                      <span className="text-sm text-gray-900">{sub.description}</span>
                      <span className="text-sm font-medium text-gray-700 ml-2 shrink-0">
                        {formatCLP(sub.net_value)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {errors.items && <p className="text-red-500 text-xs mt-1">{errors.items}</p>}
      </div>

      {/* Tabla de líneas */}
      {items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-yellow-400">
                <th className="text-left px-4 py-3 font-semibold">Descripción</th>
                <th className="text-center px-3 py-3 font-semibold w-28">Cantidad</th>
                <th className="text-right px-3 py-3 font-semibold w-36">Precio Unit.</th>
                <th className="text-right px-3 py-3 font-semibold w-32">Total Línea</th>
                <th className="w-10"></th>
              </tr>
            </thead>
<tbody>
               {items.map((item, i) => {
                 const qty = parseFloat(item.quantity) || 0
                 const price = parseFloat(item.unit_price) || 0
                 const lineTotal = qty * price
                 const qtyInvalid = item.quantity !== '' && qty <= 0
                 const isExtra = !item.price_sub_item

                 return (
                   <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                     <td className="px-4 py-3">
                       {isExtra ? (
                         <input
                           type="text"
                           value={item.description}
                           onChange={e => updateItem(i, 'description', e.target.value)}
                           placeholder="Descripción del gasto"
                           className="w-full px-2 py-1 border border-gray-300 rounded-lg text-sm focus:border-yellow-500 outline-none"
                         />
                       ) : (
                         <span className="text-gray-900 font-medium">{item.description}</span>
                       )}
                     </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.quantity ? formatNumberWithThousands(item.quantity) : ''}
                        onFocus={e => {
                          const num = parseNumberFromThousands(item.quantity)
                          e.target.value = num
                        }}
                        onBlur={e => {
                          const num = parseNumberFromThousands(e.target.value)
                          e.target.value = num ? formatNumberWithThousands(num) : ''
                        }}
                        onChange={e => {
                          const rawValue = e.target.value
                          const prevValue = String(item.quantity)
                          const cursorPos = e.target.selectionStart
                          const num = parseNumberFromThousands(rawValue)
                          updateItem(i, 'quantity', num || '')
                          // Mantener cursor en posición lógica
                          setTimeout(() => {
                            const newFormatted = num ? formatNumberWithThousands(num) : ''
                            const diff = newFormatted.length - rawValue.length
                            e.target.setSelectionRange(Math.max(0, cursorPos + diff), Math.max(0, cursorPos + diff))
                          }, 0)
                        }}
                        className={`w-full text-center px-2 py-1 border rounded-lg text-sm focus:border-yellow-500 outline-none ${
                          qtyInvalid || errors[`qty_${i}`] ? 'border-red-400 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                      {qtyInvalid && (
                        <p className="text-xs text-red-500 text-center mt-0.5">Debe ser &gt; 0</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.unit_price ? formatNumberWithThousands(item.unit_price) : ''}
                        onFocus={e => {
                          const num = parseNumberFromThousands(item.unit_price)
                          e.target.value = num
                        }}
                        onBlur={e => {
                          const num = parseNumberFromThousands(e.target.value)
                          e.target.value = num ? formatNumberWithThousands(num) : ''
                        }}
                        onChange={e => {
                          const rawValue = e.target.value
                          const num = parseNumberFromThousands(rawValue)
                          updateItem(i, 'unit_price', num || '')
                        }}
                        className={`w-full text-right px-2 py-1 border rounded-lg text-sm focus:border-yellow-500 outline-none ${
                          errors[`price_${i}`] ? 'border-red-400 bg-red-50' : 'border-gray-300'
                        }`}
                      />
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-gray-900">
                      {formatCLP(lineTotal)}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="text-red-400 hover:text-red-600 text-lg leading-none"
                        title="Eliminar línea"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumen financiero */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="w-80 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            {/* Discount input */}
            <div className="px-4 py-3 border-b border-gray-200">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                Descuento (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPercentage}
                onChange={e => setDiscountPercentage(e.target.value)}
                className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:border-yellow-500 outline-none ${
                  !isDiscountFieldValid ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
              {!isDiscountFieldValid && (
                <p className="text-xs text-red-500 mt-1">Debe estar entre 0 y 100</p>
              )}
              {errors.discount && (
                <p className="text-xs text-red-500 mt-1">{errors.discount}</p>
              )}
            </div>

            {/* Summary lines */}
            <div className="px-4 py-3 flex justify-between text-sm text-gray-700">
              <span>Subtotal</span>
              <span className="font-medium">{formatCLP(subtotal)}</span>
            </div>

            {discountPct > 0 && (
              <div className="px-4 py-3 flex justify-between text-sm text-gray-700 border-t border-gray-200">
                <span>Descuento ({discountPct}%)</span>
                <span className="font-medium text-red-600">-{formatCLP(discountAmount)}</span>
              </div>
            )}

            <div className="px-4 py-3 flex justify-between text-sm text-gray-700 border-t border-gray-200">
              <span>Total</span>
              <span className="font-medium">{formatCLP(total)}</span>
            </div>

            <div className="px-4 py-3 flex justify-between text-sm text-gray-700 border-t border-gray-200">
              <span>IVA ({IVA_PERCENT_LABEL})</span>
              <span className="font-medium">{formatCLP(taxAmount)}</span>
            </div>

            <div className="px-4 py-3 flex justify-between bg-gray-900 text-yellow-400">
              <span className="font-bold text-sm">TOTAL NETO</span>
              <span className="font-bold text-sm">{formatCLP(totalAmount)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !isDiscountFieldValid}
          className="px-5 py-2.5 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Guardando...' : 'Guardar Cotización'}
        </button>
      </div>
    </form>
  )
}
