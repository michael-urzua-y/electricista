import { useState } from 'react'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid'
import { InformationCircleIcon } from '@heroicons/react/24/outline'

const formatValue = (value, format) => {
  if (value === null || value === undefined) return '—'
  if (format === 'currency') {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency', currency: 'CLP', minimumFractionDigits: 0,
    }).format(value)
  }
  if (format === 'percent') return `${Number(value).toFixed(1)}%`
  return String(value)
}

export default function KpiCard({ title, value, prevValue, format = 'number', tooltip }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const hasPrev = prevValue !== null && prevValue !== undefined && Number(prevValue) !== 0
  const current = Number(value ?? 0)
  const prev = Number(prevValue ?? 0)

  let variationEl = null
  if (!hasPrev) {
    variationEl = <span className="text-xs text-gray-400">N/A vs mes anterior</span>
  } else {
    const diff = current - prev
    const pct = ((diff / prev) * 100).toFixed(1)
    const isUp = diff >= 0
    variationEl = (
      <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isUp ? 'text-green-600' : 'text-red-500'}`}>
        {isUp ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
        {Math.abs(pct)}% vs mes anterior
      </span>
    )
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{title}</p>
        {tooltip && (
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
              className="text-gray-300 hover:text-gray-500 transition-colors"
              aria-label={`Información sobre ${title}`}
            >
              <InformationCircleIcon className="w-4 h-4" />
            </button>
            {showTooltip && (
              <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed pointer-events-none">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-2">{formatValue(value, format)}</p>
      {variationEl}
    </div>
  )
}
