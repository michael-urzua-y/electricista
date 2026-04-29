import { useState, useEffect } from 'react'
import api from '../services/api'
import Pagination from '../components/Pagination'

export default function Products() {
  const [products, setProducts] = useState([])
  const [providers, setProviders] = useState([])
  // selectedProvider stores the provider object { id, name } or null
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPages, setCurrentPages] = useState({})
  const itemsPerPage = 10

  // Reset pagination when provider filter changes
  useEffect(() => {
    setCurrentPages({})
  }, [selectedProvider])

  useEffect(() => {
    fetchProviders()
  }, [])

  // Re-fetch products whenever the selected provider changes
  useEffect(() => {
    fetchProducts(selectedProvider?.id ?? null)
  }, [selectedProvider])

  const fetchProducts = async (providerId) => {
    setLoading(true)
    try {
      const params = providerId ? { provider: providerId } : {}
      const res = await api.get('/productos/', { params })
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setProducts(data)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProviders = async () => {
    try {
      const res = await api.get('/proveedores/')
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setProviders(data)
    } catch (error) {
      console.error('Error fetching providers:', error)
    }
  }

  const handleProviderChange = (e) => {
    const id = e.target.value
    if (!id) {
      setSelectedProvider(null)
    } else {
      const found = providers.find(p => String(p.id) === String(id))
      setSelectedProvider(found ?? null)
    }
  }

  // When a specific provider is selected, show one table for that provider.
  // When showing all, group products by each provider they belong to.
  const productsByProvider = {}
  if (selectedProvider) {
    productsByProvider[selectedProvider.name] = products
  } else {
    products.forEach(p => {
      const names = p.provider_names?.length > 0 ? p.provider_names : ['Sin proveedor']
      names.forEach(provName => {
        if (!productsByProvider[provName]) {
          productsByProvider[provName] = []
        }
        if (!productsByProvider[provName].some(item => item.id === p.id)) {
          productsByProvider[provName].push(p)
        }
      })
    })
  }

  const goToPage = (providerName, page) => {
    setCurrentPages(prev => ({ ...prev, [providerName]: page }))
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-500 mt-1">
            {selectedProvider
              ? `Productos de ${selectedProvider.name}`
              : 'Todos los productos por proveedor'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="provider-filter" className="text-sm font-medium text-gray-700">
            Filtrar por proveedor:
          </label>
          <select
            id="provider-filter"
            value={selectedProvider?.id ?? ''}
            onChange={handleProviderChange}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 outline-none"
          >
            <option value="">Todos los proveedores</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tablas por proveedor */}
      {Object.keys(productsByProvider).length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500">No hay productos registrados.</p>
        </div>
      ) : (
        Object.entries(productsByProvider)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([providerName, prodList]) => {
            const currentPage = currentPages[providerName] || 1
            const totalPages = Math.ceil(prodList.length / itemsPerPage)
            const startIdx = (currentPage - 1) * itemsPerPage
            const paginatedProducts = prodList.slice(startIdx, startIdx + itemsPerPage)

            return (
              <div key={providerName} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{providerName}</h2>
                    <p className="text-sm text-gray-500">{prodList.length} producto(s) total</p>
                  </div>
                  {totalPages > 1 && (
                    <span className="text-sm text-gray-500">
                      Página {currentPage} de {totalPages}
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Producto</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Categoría</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Último Precio</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Margen (%)</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-green-600 uppercase tracking-wider">A Cobrar</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-blue-600 uppercase tracking-wider">Stock</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Proveedores</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedProducts.map(product => {
                        // When viewing all providers, markup/sell_price may be a dict keyed by provider name
                        const markupRaw = product.markup_percentage
                        const sellRaw = product.sell_price

                        const markupValue = (() => {
                          if (!markupRaw || markupRaw === '0') return 0
                          if (typeof markupRaw === 'object') {
                            return Math.round(Number(markupRaw[providerName] ?? 0))
                          }
                          return Math.round(Number(markupRaw))
                        })()

                        // latest_price puede ser un dict {providerName: {price, ...}} o un objeto directo
                        const latestPriceForProvider = (() => {
                          const lp = product.latest_price
                          if (!lp) return null
                          // Si es dict por proveedor (sin filtro)
                          if (lp[providerName]) return lp[providerName]
                          // Si es objeto directo (con filtro de proveedor)
                          if (lp.price) return lp
                          return null
                        })()

                        const price = latestPriceForProvider ? Number(latestPriceForProvider.price) : 0

                        const sellValue = (() => {
                          if (!sellRaw) return price > 0 && markupValue > 0 ? price * (1 + markupValue / 100) : 0
                          if (typeof sellRaw === 'object') {
                            const v = sellRaw[providerName]
                            return v ? Number(v) : (price > 0 && markupValue > 0 ? price * (1 + markupValue / 100) : 0)
                          }
                          return Number(sellRaw)
                        })()

                        // Stock desde ProviderInventory
                        const stockValue = (() => {
                          const ps = product.provider_stock
                          if (ps === null || ps === undefined) return null
                          if (typeof ps === 'object') return ps[providerName] ?? null
                          return ps
                        })()

                        return (
                          <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div>
                                <p className="font-medium text-gray-900">{product.name}</p>
                                {product.brand && (
                                  <p className="text-xs text-gray-500">Marca: {product.brand}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {product.category || 'General'}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                              {latestPriceForProvider
                                ? (
                                  <span>
                                    {formatCurrency(latestPriceForProvider.price)}
                                    {!selectedProvider && (
                                      <span className="ml-1 text-xs font-normal text-gray-400">
                                        ({latestPriceForProvider.provider})
                                      </span>
                                    )}
                                  </span>
                                )
                                : 'Sin precio'}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {markupValue > 0
                                ? <span className="font-medium text-gray-900">{markupValue}%</span>
                                : <span className="text-gray-400">0%</span>}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-green-600">
                              {sellValue > 0 ? formatCurrency(sellValue) : '—'}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {stockValue !== null && stockValue !== undefined
                                ? (
                                  <span className={`font-semibold ${stockValue > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                    {stockValue}
                                  </span>
                                )
                                : <span className="text-gray-400">—</span>
                              }
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {product.provider_names?.length > 0
                                ? product.provider_names.join(', ')
                                : 'Sin proveedores'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(p) => goToPage(providerName, p)}
                    totalItems={prodList.length}
                    pageSize={itemsPerPage}
                  />
                )}
              </div>
            )
          })
      )}
    </div>
  )
}
