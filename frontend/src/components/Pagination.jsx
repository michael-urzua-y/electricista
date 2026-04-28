/**
 * Pagination - Componente de paginación unificado.
 * Props:
 *   currentPage  - number (1-based)
 *   totalPages   - number
 *   onPageChange - callback(page: number)
 *   totalItems   - number (opcional, para mostrar "X registros")
 *   pageSize     - number (opcional)
 */
export default function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize = 20 }) {
  if (totalPages <= 1) return null

  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  const from = (currentPage - 1) * pageSize + 1
  const to   = Math.min(currentPage * pageSize, totalItems ?? currentPage * pageSize)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
      {/* Info de registros */}
      {totalItems != null && (
        <p className="text-sm text-gray-500 order-2 sm:order-1">
          Mostrando <span className="font-medium text-gray-700">{from}–{to}</span> de{' '}
          <span className="font-medium text-gray-700">{totalItems}</span> registros
        </p>
      )}

      {/* Botones */}
      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-white hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Anterior
        </button>

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-2 text-gray-400 text-sm">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[36px] px-3 py-2 text-sm rounded-lg border transition-colors ${
                p === currentPage
                  ? 'bg-primary-600 text-white border-primary-600 font-medium'
                  : 'border-gray-200 text-gray-600 hover:bg-white hover:border-gray-300'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-white hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Siguiente →
        </button>
      </div>
    </div>
  )
}
