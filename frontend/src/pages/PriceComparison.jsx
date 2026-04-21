import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  ArrowPathIcon,
  CheckIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline'

export default function PriceComparison() {
  const [comparisons, setComparisons] = useState([])
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchComparisons()
    fetchProviders()
  }, [])

  const fetchComparisons = async () => {
    try {
      const res = await axios.get('/api/comparacion/')
      setComparisons(Array.isArray(res.data) ? res.data : res.data.results || [])
    } catch (error) {
      console.error('Error fetching comparison:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProviders = async () => {
    try {
      const res = await axios.get('/api/proveedores/')
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setProviders(data)
    } catch (error) {
      console.error('Error fetching providers:', error)
    }
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '—'
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Comparación de Precios</h1>
          <p className="text-gray-500 mt-1">Compara precios de productos entre proveedores</p>
        </div>
        <button
          onClick={fetchComparisons}
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <ArrowPathIcon className="w-5 h-5" />
          Actualizar
        </button>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Producto</th>
                {providers.map(p => (
                  <th key={p.id} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {p.name}
                  </th>
                ))}
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Mejor precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {comparisons.length === 0 ? (
                <tr>
                  <td colSpan={providers.length + 2} className="px-6 py-12 text-center">
                    <p className="text-gray-500">No hay productos registrados aún.</p>
                    <p className="text-sm text-gray-400 mt-1">Sube facturas para extraer productos y precios.</p>
                  </td>
                </tr>
              ) : (
                comparisons.map((comp) => (
                  <tr key={comp.product_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{comp.product_name}</p>
                        {comp.category && (
                          <p className="text-xs text-gray-500">{comp.category}</p>
                        )}
                      </div>
                    </td>
                    {providers.map(provider => {
                      const price = comp.prices?.[provider.name] ?? null
                      const isBest = comp.best_provider === provider.name
                      const isWorst = comp.worst_provider === provider.name
                      return (
                        <td 
                          key={provider.id} 
                          className={`px-6 py-4 text-sm font-semibold ${
                            isBest ? 'bg-green-50 text-green-700' : 
                            isWorst ? 'bg-red-50 text-red-700' : 
                            'text-gray-900'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {formatCurrency(price)}
                            {isBest && <CheckIcon className="w-4 h-4 text-green-600" />}
                          </div>
                        </td>
                      )
                    })}
                    <td className="px-6 py-4">
                      {comp.best_provider ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-700">
                            <ArrowDownIcon className="w-3 h-3" />
                            {comp.best_provider}
                          </span>
                          <span className="text-xs font-semibold text-gray-600">
                            {formatCurrency(comp.best_price)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Sin datos</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
          <span>Más barato</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
          <span>Más caro</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
          <span>Sin variación / sin datos</span>
        </div>
      </div>
    </div>
  )
}
