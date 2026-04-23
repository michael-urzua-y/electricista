import { useState, useRef, useEffect } from 'react'

/**
 * InvoiceSearchInput - Searchable input that filters invoices by number or date.
 *
 * Props:
 *   invoices    - array of { id, invoice_number, provider_name, issue_date }
 *   value       - selected invoice id (string)
 *   onChange     - callback(invoiceId: string)
 *   placeholder  - input placeholder text
 *   label        - label text
 *   id           - input id for accessibility
 */
export default function InvoiceSearchInput({ invoices = [], value, onChange, placeholder = 'Buscar factura...', label, id }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef(null)

  // Find selected invoice to show its label
  const selectedInvoice = invoices.find(inv => String(inv.id) === String(value))

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formatLabel = (inv) =>
    `${inv.invoice_number || `#${inv.id}`} — ${inv.provider_name || 'Sin proveedor'} — ${inv.issue_date || 'Sin fecha'}`

  const filtered = invoices.filter(inv => {
    if (!query) return false
    const text = formatLabel(inv).toLowerCase()
    return text.includes(query.toLowerCase())
  })

  const handleSelect = (inv) => {
    onChange(String(inv.id))
    setQuery('')
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setQuery('')
  }

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      {/* Show selected invoice or search input */}
      {selectedInvoice && !isOpen ? (
        <div className="flex items-center gap-2 w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
          <span className="flex-1 text-sm text-gray-900 truncate">{formatLabel(selectedInvoice)}</span>
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 hover:text-gray-600 shrink-0"
          >
            ✕
          </button>
        </div>
      ) : (
        <input
          id={id}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 outline-none"
          autoComplete="off"
        />
      )}

      {/* Dropdown - only show when there's a query with results */}
      {isOpen && query.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">Sin resultados</div>
          ) : (
            filtered.map(inv => (
              <button
                key={inv.id}
                type="button"
                onClick={() => handleSelect(inv)}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-primary-50 transition-colors ${
                  String(inv.id) === String(value) ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700'
                }`}
              >
                {formatLabel(inv)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
