import { useState, useRef, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'

const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

/**
 * MonthPicker profesional con meses habilitados/deshabilitados.
 * availableMonths: array de { year, month } con datos
 * value: { year, month } | null (null = todos los meses)
 * onChange: ({ year, month } | null) => void
 */
export default function MonthPicker({ value, onChange, availableMonths = [] }) {
  const now = new Date()
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(value?.year || now.getFullYear())
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const availableSet = new Set(availableMonths.map(m => `${m.year}-${m.month}`))
  const currentKey = `${now.getFullYear()}-${now.getMonth() + 1}`

  const isAvailable = (year, month) => availableSet.has(`${year}-${month}`)
  const isDisabled = (year, month) => !isAvailable(year, month)

  const canGoPrev = () => viewYear > now.getFullYear() - 4
  const canGoNext = () => viewYear < now.getFullYear() + 1

  const handleSelect = (month) => {
    if (isDisabled(viewYear, month)) return
    onChange({ year: viewYear, month })
    setOpen(false)
  }

  const handleSelectAll = () => {
    onChange(null)
    setOpen(false)
  }

  const label = value
    ? `${MESES_LARGO[value.month - 1]} ${value.year}`
    : 'Todos los meses'

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:border-yellow-500 hover:bg-yellow-50 transition-all shadow-sm"
      >
        <CalendarDaysIcon className="w-4 h-4 text-gray-400" />
        <span>{label}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-fade-in">
          {/* Year navigation */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
            <button
              type="button"
              onClick={() => canGoPrev() && setViewYear(y => y - 1)}
              disabled={!canGoPrev()}
              className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-400 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span className="text-white font-bold text-base">{viewYear}</span>
            <button
              type="button"
              onClick={() => canGoNext() && setViewYear(y => y + 1)}
              disabled={!canGoNext()}
              className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-400 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Ver todos option */}
          <button
            type="button"
            onClick={handleSelectAll}
            className={`w-full px-4 py-2.5 text-sm font-medium text-left transition-colors ${
              value === null
                ? 'bg-yellow-50 text-yellow-700 font-bold'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            📅 Todos los meses
          </button>

          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1.5 p-3">
            {MESES_CORTO.map((m, i) => {
              const month = i + 1
              const disabled = isDisabled(viewYear, month)
              const selected = value?.year === viewYear && value?.month === month
              const isCurrent = `${viewYear}-${month}` === currentKey
              const hasData = isAvailable(viewYear, month)

              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => handleSelect(month)}
                  disabled={disabled}
                  className={`
                    relative py-2.5 rounded-xl text-sm font-medium transition-all
                    ${selected
                      ? 'bg-yellow-500 text-gray-900 shadow-md'
                      : disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-yellow-50 hover:text-yellow-700'
                    }
                    ${isCurrent && !selected ? 'ring-1 ring-yellow-400' : ''}
                  `}
                >
                  {m}
                  {/* Dot indicator for months with data */}
                  {hasData && !selected && !disabled && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-yellow-500" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="px-4 pb-3 flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
              Con datos
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm ring-1 ring-yellow-400 inline-block" />
              Mes actual
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
