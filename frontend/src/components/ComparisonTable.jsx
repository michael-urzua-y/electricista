import { useState } from 'react'
import PriceVariationBadge from './PriceVariationBadge'
import Pagination from './Pagination'

const PAGE_SIZE = 10

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

export default function ComparisonTable({
  productos = [],
  emptyMessage = 'No hay productos en común entre las facturas.',
}) {
  const [page, setPage] = useState(1)

  if (!productos || productos.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    )
  }

  const totalPages = Math.ceil(productos.length / PAGE_SIZE)
  const paginated = productos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Producto</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Precio Anterior</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Precio Actual</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Diferencia</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Variación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.map((producto, idx) => (
              <tr key={producto.producto_id ?? idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4"><p className="font-medium text-gray-900">{producto.producto_nombre}</p></td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">{formatCurrency(producto.precio_anterior)}</td>
                <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">{formatCurrency(producto.precio_actual)}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">{formatCurrency(producto.diferencia)}</td>
                <td className="px-6 py-4 text-center"><PriceVariationBadge variacion={producto.variacion_porcentual} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-gray-100">
        {paginated.map((producto, idx) => (
          <div key={producto.producto_id ?? idx} className="p-4 space-y-2">
            <p className="font-medium text-gray-900 text-sm">{producto.producto_nombre}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Anterior: </span>
                <span className="text-gray-700">{formatCurrency(producto.precio_anterior)}</span>
              </div>
              <div>
                <span className="text-gray-500">Actual: </span>
                <span className="font-semibold text-gray-900">{formatCurrency(producto.precio_actual)}</span>
              </div>
              <div>
                <span className="text-gray-500">Diferencia: </span>
                <span className="text-gray-700">{formatCurrency(producto.diferencia)}</span>
              </div>
              <div className="flex items-center">
                <PriceVariationBadge variacion={producto.variacion_porcentual} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  )
}
