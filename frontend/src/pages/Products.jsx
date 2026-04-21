import { useState, useEffect } from 'react'
import api from '../services/api'

export default function Products() {
  const [products, setProducts] = useState([])
  const [providers, setProviders] = useState([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [loading, setLoading] = useState(true)
  const [currentPages, setCurrentPages] = useState({})
  const itemsPerPage = 10

  // Reset current page when provider filter changes
  useEffect(() => {
    setCurrentPages({})
  }, [selectedProvider])

  useEffect(() => {
    fetchProducts()
    fetchProviders()
  }, [])

  const fetchProducts = async () => {
    try {
      const res = await api.get('/productos/')
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

  // Filtrar productos por proveedor seleccionado
  const filteredProducts = selectedProvider
    ? products.filter(p => p.provider_names?.includes(selectedProvider))
    : products

  // Agrupamos productos por proveedor para mostrar tablas separadas
  const productsByProvider = {}
  if (selectedProvider) {
    productsByProvider[selectedProvider] = filteredProducts
  } else {
    filteredProducts.forEach(p => {
      p.provider_names?.forEach(provName => {
        if (!productsByProvider[provName]) {
          productsByProvider[provName] = []
        }
        if (!productsByProvider[provName].find(item => item.id === p.id)) {
          productsByProvider[provName].push(p)
        }
      })
    })
  }

  // Handlers de paginación
  const goToPage = (providerName, page) => {
    setCurrentPages(prev => ({ ...prev, [providerName]: page }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(value)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header con selector de proveedor */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-500 mt-1">
            {selectedProvider ? `Productos de ${selectedProvider}` : 'Todos los productos por proveedor'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Filtrar por proveedor:</label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 outline-none"
          >
            <option value="">Todos los proveedores</option>
            {providers.map(p => (
              <option key={p.id} value={p.name}>{p.name}</option>
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
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Proveedores</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedProducts.map(product => (
                        <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-gray-900">{product.name}</p>
                              {product.brand && <p className="text-xs text-gray-500">Marca: {product.brand}</p>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {product.category || 'General'}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            {product.latest_price ? formatCurrency(product.latest_price.price) : 'Sin precio'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {product.provider_names?.length > 0 
                              ? product.provider_names.join(', ')
                              : 'Sin proveedores'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-100">
                    <span className="text-sm text-gray-600">
                      Mostrando {startIdx + 1}–{Math.min(startIdx + itemsPerPage, prodList.length)} de {prodList.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => goToPage(providerName, Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .map((p, idx, arr) => (
                          <span key={p} className="flex items-center">
                            {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-2">...</span>}
                            <button
                              onClick={() => goToPage(providerName, p)}
                              className={`px-3 py-1 text-sm rounded ${
                                p === currentPage
                                  ? 'bg-primary-600 text-white'
                                  : 'border hover:bg-gray-100'
                              }`}
                            >
                              {p}
                            </button>
                          </span>
                        ))}
                      <button
                        onClick={() => goToPage(providerName, Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
      )}
    </div>
  )
}
