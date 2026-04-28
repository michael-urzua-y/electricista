import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import ComparisonTable from '../components/ComparisonTable'
import PriceVariationBadge from '../components/PriceVariationBadge'
import InvoiceSearchInput from '../components/InvoiceSearchInput'
import Pagination from '../components/Pagination'

const TABS = [
  { key: 'auto', label: 'Comparación Automática' },
  { key: 'manual', label: 'Comparación Manual' },
  { key: 'monthly', label: 'Resumen Mensual' },
  { key: 'providers', label: 'Entre Proveedores' },
]

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '—'
  const num = Number(value)
  if (isNaN(num)) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(num)
}

const Spinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
  </div>
)

// ─── Comparación Automática ────────────────────────────────────────────────────
function AutoTab() {
  const [invoices, setInvoices] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingInvoices, setLoadingInvoices] = useState(true)

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await api.get('/facturas/', { params: { status: 'completed' } })
        const data = res.data?.results ?? res.data ?? []
        setInvoices(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Error fetching invoices:', err)
      } finally {
        setLoadingInvoices(false)
      }
    }
    fetchInvoices()
  }, [])

  const handleSelect = async (id) => {
    setSelectedId(id)
    setResult(null)
    if (!id) return

    setLoading(true)
    try {
      const res = await api.get(`/facturas/${id}/comparar-anterior/`)
      // Asegurar que el resultado tiene la estructura correcta
      if (res.data && typeof res.data === 'object') {
        setResult(res.data)
      } else {
        setResult({ error: 'Respuesta inválida del servidor.' })
      }
    } catch (err) {
      console.error('Error comparing:', err)
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || 'Error al obtener la comparación.'
      setResult({ error: errorMsg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {loadingInvoices ? (
          <Spinner />
        ) : (
          <InvoiceSearchInput
            id="auto-invoice-search"
            label="Buscar factura completada"
            invoices={invoices}
            value={selectedId}
            onChange={handleSelect}
            placeholder="Buscar por número de factura o fecha..."
          />
        )}
      </div>

      {loading && <Spinner />}

      {!loading && result && (
        <>
          {result.error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
              {result.error}
            </div>
          ) : result.factura_anterior === null ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg p-4 text-sm">
              {result.mensaje || 'No existe factura anterior para este proveedor.'}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Factura Actual</p>
                  <p className="font-semibold text-gray-900">
                    {result.factura_actual?.numero || `#${result.factura_actual?.id}`}
                  </p>
                  <p className="text-sm text-gray-500">{result.factura_actual?.fecha_emision}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Factura Anterior</p>
                  <p className="font-semibold text-gray-900">
                    {result.factura_anterior?.numero || `#${result.factura_anterior?.id}`}
                  </p>
                  <p className="text-sm text-gray-500">{result.factura_anterior?.fecha_emision}</p>
                </div>
              </div>
              <ComparisonTable productos={result.productos_comunes} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Comparación Manual ────────────────────────────────────────────────────────
function ManualTab() {
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [invoices, setInvoices] = useState([])
  const [baseId, setBaseId] = useState('')
  const [compareId, setCompareId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await api.get('/proveedores/')
        const data = res.data?.results ?? res.data ?? []
        setProviders(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Error fetching providers:', err)
      }
    }
    fetchProviders()
  }, [])

  const handleProviderChange = async (e) => {
    const providerId = e.target.value
    setSelectedProvider(providerId)
    setBaseId('')
    setCompareId('')
    setResult(null)
    setError('')
    setInvoices([])

    if (!providerId) return

    setLoadingInvoices(true)
    try {
      const res = await api.get('/facturas/', { params: { status: 'completed', provider: providerId } })
      const data = res.data?.results ?? res.data ?? []
      setInvoices(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching invoices:', err)
    } finally {
      setLoadingInvoices(false)
    }
  }

  const handleCompare = async () => {
    if (!baseId || !compareId) return
    setLoading(true)
    setResult(null)
    setError('')

    try {
      const res = await api.get('/facturas/comparar-manual/', {
        params: { factura_base: baseId, factura_comparar: compareId },
      })
      // Asegurar que el resultado tiene la estructura correcta
      if (res.data && typeof res.data === 'object') {
        setResult(res.data)
      } else {
        setError('Respuesta inválida del servidor.')
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Error al comparar facturas.'
      setError(msg)
      console.error('Error comparing:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        {/* Provider selector */}
        <div>
          <label htmlFor="manual-provider-select" className="block text-sm font-medium text-gray-700 mb-2">
            Proveedor
          </label>
          <select
            id="manual-provider-select"
            value={selectedProvider}
            onChange={handleProviderChange}
            className="w-full max-w-md px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 outline-none"
          >
            <option value="">— Seleccionar proveedor —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {loadingInvoices && <Spinner />}

        {selectedProvider && !loadingInvoices && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InvoiceSearchInput
              id="manual-base-search"
              label="Factura Base (anterior)"
              invoices={invoices}
              value={baseId}
              onChange={(id) => { setBaseId(id); setResult(null); setError('') }}
              placeholder="Buscar factura base..."
            />
            <InvoiceSearchInput
              id="manual-compare-search"
              label="Factura a Comparar (actual)"
              invoices={invoices}
              value={compareId}
              onChange={(id) => { setCompareId(id); setResult(null); setError('') }}
              placeholder="Buscar factura a comparar..."
            />
          </div>
        )}

        {selectedProvider && !loadingInvoices && (
          <button
            onClick={handleCompare}
            disabled={!baseId || !compareId || loading}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Comparar
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {loading && <Spinner />}

      {!loading && result && (
        <ComparisonTable productos={result.productos_comunes} />
      )}
    </div>
  )
}


// ─── Monthly Table (paginated + responsive) ───────────────────────────────────
function MonthlyTable({ productos = [] }) {
  const [page, setPage] = useState(1)
  const totalPages = Math.ceil(productos.length / 10)
  const paginated = productos.slice((page - 1) * 10, page * 10)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Producto</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Mínimo</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Máximo</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Promedio</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Variación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.map((prod, idx) => (
              <tr key={prod.producto_id ?? idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4"><p className="font-medium text-gray-900">{prod.producto_nombre}</p></td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">{formatCurrency(prod.precio_minimo)}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">{formatCurrency(prod.precio_maximo)}</td>
                <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">{formatCurrency(prod.precio_promedio)}</td>
                <td className="px-6 py-4 text-center"><PriceVariationBadge variacion={prod.variacion_porcentual} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden divide-y divide-gray-100">
        {paginated.map((prod, idx) => (
          <div key={prod.producto_id ?? idx} className="p-4 space-y-2">
            <p className="font-medium text-gray-900 text-sm">{prod.producto_nombre}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-500">Mín: </span><span>{formatCurrency(prod.precio_minimo)}</span></div>
              <div><span className="text-gray-500">Máx: </span><span>{formatCurrency(prod.precio_maximo)}</span></div>
              <div><span className="text-gray-500">Prom: </span><span className="font-semibold">{formatCurrency(prod.precio_promedio)}</span></div>
              <div><PriceVariationBadge variacion={prod.variacion_porcentual} /></div>
            </div>
          </div>
        ))}
      </div>
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}

// ─── Resumen Mensual ───────────────────────────────────────────────────────────
function MonthlyTab() {
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await api.get('/proveedores/')
        const data = res.data?.results ?? res.data ?? []
        setProviders(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Error fetching providers:', err)
      }
    }
    fetchProviders()
  }, [])

  const fetchMonthly = useCallback(async () => {
    if (!selectedProvider) return
    setLoading(true)
    setResult(null)
    try {
      const res = await api.get('/facturas/comparar-mes/', {
        params: { proveedor_id: selectedProvider, year, month },
      })
      // Asegurar que el resultado tiene la estructura correcta
      if (res.data && typeof res.data === 'object') {
        setResult(res.data)
      } else {
        setResult({ error: 'Respuesta inválida del servidor.' })
      }
    } catch (err) {
      console.error('Error fetching monthly comparison:', err)
      const errorMsg = err.response?.data?.detail || err.response?.data?.error || 'Error al obtener el resumen mensual.'
      setResult({ error: errorMsg })
    } finally {
      setLoading(false)
    }
  }, [selectedProvider, year, month])

  // Auto-fetch when provider or period changes
  useEffect(() => {
    if (selectedProvider) {
      fetchMonthly()
    }
  }, [selectedProvider, year, month, fetchMonthly])

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ]

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Provider */}
          <div>
            <label htmlFor="monthly-provider-select" className="block text-sm font-medium text-gray-700 mb-2">
              Proveedor
            </label>
            <select
              id="monthly-provider-select"
              value={selectedProvider}
              onChange={(e) => { setSelectedProvider(e.target.value); setResult(null) }}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 outline-none"
            >
              <option value="">— Seleccionar proveedor —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div>
            <label htmlFor="monthly-month-select" className="block text-sm font-medium text-gray-700 mb-2">
              Mes
            </label>
            <select
              id="monthly-month-select"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 outline-none"
            >
              {monthNames.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div>
            <label htmlFor="monthly-year-select" className="block text-sm font-medium text-gray-700 mb-2">
              Año
            </label>
            <select
              id="monthly-year-select"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 outline-none"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && <Spinner />}

      {!loading && result && (
        <>
          {result.error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
              {result.error}
            </div>
          ) : result.facturas?.length === 0 || result.productos?.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg p-4 text-sm">
              {result.mensaje || 'No hay facturas de este proveedor en el período indicado.'}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Invoice count badge */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-primary-50 text-primary-700">
                  {result.facturas?.length ?? 0} factura(s) en el período
                </span>
                <span className="text-sm text-gray-500">
                  {monthNames[month - 1]} {year} — {result.proveedor}
                </span>
              </div>

              {/* Monthly products table */}
              <MonthlyTable productos={result.productos} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Entre Proveedores ─────────────────────────────────────────────────────────
function ProvidersTab() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/facturas/comparar-proveedores/')
        // Asegurar que el resultado tiene la estructura correcta
        if (res.data && typeof res.data === 'object') {
          setResult(res.data)
        } else {
          setResult({ error: 'Respuesta inválida del servidor.' })
        }
      } catch (err) {
        console.error('Error fetching provider comparison:', err)
        const errorMsg = err.response?.data?.detail || err.response?.data?.error || 'Error al obtener la comparación.'
        setResult({ error: errorMsg })
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) return <Spinner />

  if (result?.error) {
    return <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{result.error}</div>
  }

  if (!result?.productos?.length) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg p-4 text-sm">
        {result?.mensaje || 'No hay productos compartidos entre proveedores.'}
      </div>
    )
  }

  const totalPages = Math.ceil(result.productos.length / 10)
  const paginated = result.productos.slice((page - 1) * 10, page * 10)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <span className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-primary-50 text-primary-700">
          {result.total_productos} producto(s) compartidos entre proveedores
        </span>
      </div>

      {paginated.map((prod) => (
        <div key={prod.producto_id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 md:px-6 py-4 bg-gray-50 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="font-semibold text-gray-900 text-sm md:text-base">{prod.producto_nombre}</p>
            <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 self-start sm:self-auto">
              ★ {prod.mejor_proveedor} — {formatCurrency(prod.mejor_precio)}
            </span>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Proveedor</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Precio</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Diferencia</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Variación</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Factura</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {prod.proveedores.map((prov) => (
                  <tr key={prov.proveedor_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {prov.proveedor_nombre}
                      {prov.proveedor_nombre === prod.mejor_proveedor && (
                        <span className="ml-2 text-green-600 text-xs">★ Más barato</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-semibold text-gray-900">{formatCurrency(prov.precio)}</td>
                    <td className="px-6 py-3 text-sm text-right text-gray-600">{formatCurrency(prov.diferencia)}</td>
                    <td className="px-6 py-3 text-center"><PriceVariationBadge variacion={prov.variacion_porcentual} /></td>
                    <td className="px-6 py-3 text-sm text-right text-gray-500">{prov.factura || '—'}</td>
                    <td className="px-6 py-3 text-sm text-right text-gray-500">{prov.fecha || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {prod.proveedores.map((prov) => (
              <div key={prov.proveedor_id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900 text-sm">
                    {prov.proveedor_nombre}
                    {prov.proveedor_nombre === prod.mejor_proveedor && (
                      <span className="ml-1 text-green-600 text-xs">★</span>
                    )}
                  </p>
                  <PriceVariationBadge variacion={prov.variacion_porcentual} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">Precio: </span><span className="font-semibold">{formatCurrency(prov.precio)}</span></div>
                  <div><span className="text-gray-500">Dif: </span><span>{formatCurrency(prov.diferencia)}</span></div>
                  <div><span className="text-gray-500">Factura: </span><span>{prov.factura || '—'}</span></div>
                  <div><span className="text-gray-500">Fecha: </span><span>{prov.fecha || '—'}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PriceComparison() {
  const [activeTab, setActiveTab] = useState('auto')

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Comparación de Precios</h1>
        <p className="text-gray-500 mt-1">Compara precios de productos entre facturas del mismo proveedor</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex gap-4 min-w-max" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap pb-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'auto' && <AutoTab />}
      {activeTab === 'manual' && <ManualTab />}
      {activeTab === 'monthly' && <MonthlyTab />}
      {activeTab === 'providers' && <ProvidersTab />}
    </div>
  )
}
