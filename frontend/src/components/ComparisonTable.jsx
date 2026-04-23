import PriceVariationBadge from './PriceVariationBadge'

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

/**
 * ComparisonTable - Reusable table for displaying productos_comunes comparisons.
 *
 * Props:
 *   productos    - array of { producto_nombre, precio_anterior, precio_actual, diferencia, variacion_porcentual }
 *   emptyMessage - string (optional) — message when list is empty
 */
export default function ComparisonTable({
  productos = [],
  emptyMessage = 'No hay productos en común entre las facturas.',
}) {
  if (!productos || productos.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Producto
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Precio Anterior
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Precio Actual
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Diferencia
              </th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Variación
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {productos.map((producto, idx) => (
              <tr key={producto.producto_id ?? idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-medium text-gray-900">{producto.producto_nombre}</p>
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">
                  {formatCurrency(producto.precio_anterior)}
                </td>
                <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                  {formatCurrency(producto.precio_actual)}
                </td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">
                  {formatCurrency(producto.diferencia)}
                </td>
                <td className="px-6 py-4 text-center">
                  <PriceVariationBadge variacion={producto.variacion_porcentual} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
