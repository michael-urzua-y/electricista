import { useState, useEffect, useCallback } from 'react'
import { ArrowDownTrayIcon, BookOpenIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import {
  getLibroCompras,
  exportLibroCompras,
  getLibroVentas,
  exportLibroVentas,
  getResumenMensual,
} from '../services/accountingApi'
import { ACCOUNTING_PAGE_SIZE } from '../config/appConfig'

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(value || 0)

// Variación: si el mes anterior es 0 o null → "N/A" en vez de un % absurdo
const formatVariacion = (value, anterior) => {
  if (value === null || value === undefined) return null
  if (!anterior || Number(anterior) === 0) return null  // evita +998%
  const n = Number(value)
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// Tarjeta del resumen con tooltip
function ResumenCard({ label, value, variacion, anterior, tooltip, colorClass = '' }) {
  const [show, setShow] = useState(false)
  const varText = formatVariacion(variacion, anterior)

  return (
    <div className={`rounded-xl border shadow-sm p-5 bg-white border-gray-100 ${colorClass}`}>
      <div className="flex items-center gap-1 mb-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
        {tooltip && (
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShow(true)}
              onMouseLeave={() => setShow(false)}
              className="text-gray-300 hover:text-gray-500 transition-colors"
            >
              <InformationCircleIcon className="w-4 h-4" />
            </button>
            {show && (
              <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed pointer-events-none">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {varText !== null ? (
        <p className={`text-xs mt-1 ${Number(variacion) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          vs mes anterior: {varText}
        </p>
      ) : variacion !== undefined ? (
        <p className="text-xs text-gray-400 mt-1">vs mes anterior: N/A</p>
      ) : null}
    </div>
  )
}

export default function Accounting() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [activeTab, setActiveTab] = useState('compras')

  const [compras, setCompras] = useState([])
  const [comprasPage, setComprasPage] = useState(1)
  const [comprasTotal, setComprasTotal] = useState(0)
  const [comprasLoading, setComprasLoading] = useState(false)

  const [ventas, setVentas] = useState([])
  const [ventasPage, setVentasPage] = useState(1)
  const [ventasTotal, setVentasTotal] = useState(0)
  const [ventasLoading, setVentasLoading] = useState(false)

  const [resumen, setResumen] = useState(null)
  const [resumenLoading, setResumenLoading] = useState(false)

  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const PAGE_SIZE = ACCOUNTING_PAGE_SIZE

  const fetchCompras = useCallback(async (y, m, page) => {
    setComprasLoading(true)
    setError('')
    try {
      const res = await getLibroCompras(y, m, page)
      const data = res.data
      setCompras(data?.results ?? (Array.isArray(data) ? data : []))
      setComprasTotal(data?.count ?? (Array.isArray(data) ? data.length : 0))
    } catch {
      setError('No se pudo cargar el Libro de Compras')
    } finally {
      setComprasLoading(false)
    }
  }, [])

  const fetchVentas = useCallback(async (y, m, page) => {
    setVentasLoading(true)
    setError('')
    try {
      const res = await getLibroVentas(y, m, page)
      const data = res.data
      setVentas(data?.results ?? (Array.isArray(data) ? data : []))
      setVentasTotal(data?.count ?? (Array.isArray(data) ? data.length : 0))
    } catch {
      setError('No se pudo cargar el Libro de Ventas')
    } finally {
      setVentasLoading(false)
    }
  }, [])

  const fetchResumen = useCallback(async (y, m) => {
    setResumenLoading(true)
    setError('')
    try {
      const res = await getResumenMensual(y, m)
      setResumen(res.data)
    } catch {
      setError('No se pudo cargar el Resumen Mensual')
    } finally {
      setResumenLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'compras') fetchCompras(year, month, comprasPage)
    else if (activeTab === 'ventas') fetchVentas(year, month, ventasPage)
    else if (activeTab === 'resumen') fetchResumen(year, month)
  }, [year, month, activeTab, comprasPage, ventasPage, fetchCompras, fetchVentas, fetchResumen])

  useEffect(() => {
    setComprasPage(1)
    setVentasPage(1)
  }, [year, month])

  const handleExport = async () => {
    setExporting(true)
    setError('')
    try {
      if (activeTab === 'compras') {
        const res = await exportLibroCompras(year, month)
        downloadBlob(res.data, `libro_compras_${year}_${String(month).padStart(2, '0')}.xlsx`)
      } else if (activeTab === 'ventas') {
        const res = await exportLibroVentas(year, month)
        downloadBlob(res.data, `libro_ventas_${year}_${String(month).padStart(2, '0')}.xlsx`)
      }
    } catch {
      setError('Error al exportar el archivo Excel')
    } finally {
      setExporting(false)
    }
  }

  const comprasTotalPages = Math.ceil(comprasTotal / PAGE_SIZE)
  const ventasTotalPages = Math.ceil(ventasTotal / PAGE_SIZE)

  const yearOptions = []
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) yearOptions.push(y)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpenIcon className="w-8 h-8 text-yellow-500" />
            Contabilidad
          </h1>
          <p className="text-gray-500 mt-1">Libros contables y resumen mensual</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'compras', label: 'Libro Compras' },
          { key: 'ventas', label: 'Libro Ventas' },
          { key: 'resumen', label: 'Resumen' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Libro Compras */}
      {activeTab === 'compras' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Libro de Compras</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {MONTHS.find(m => m.value === month)?.label} {year} — {comprasTotal} registro(s)
              </p>
            </div>
            <button onClick={handleExport} disabled={exporting || comprasLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
              <ArrowDownTrayIcon className="w-4 h-4" />
              {exporting ? 'Exportando...' : 'Exportar Excel'}
            </button>
          </div>
          {comprasLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
            </div>
          ) : compras.length === 0 ? (
            <p className="px-6 py-12 text-center text-gray-400 text-sm">No hay registros para este período</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">RUT Proveedor</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Razón Social</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Folio</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Neto</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">IVA</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {compras.map((row, idx) => {
                      const sinRut = !row.rut_proveedor || row.rut_proveedor === 'Sin RUT'
                      return (
                        <tr key={row.id ?? idx} className={sinRut ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                          <td className={`px-4 py-3 font-mono text-xs ${sinRut ? 'text-yellow-700 font-semibold' : 'text-gray-600'}`}>
                            {sinRut ? 'Sin RUT' : row.rut_proveedor}
                          </td>
                          <td className="px-4 py-3 text-gray-900">{row.razon_social || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{row.folio || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{row.fecha || '—'}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(row.neto)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(row.iva)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.total)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {comprasTotalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
                  <span>Página {comprasPage} de {comprasTotalPages}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setComprasPage(p => Math.max(1, p - 1))} disabled={comprasPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">Anterior</button>
                    <button onClick={() => setComprasPage(p => Math.min(comprasTotalPages, p + 1))} disabled={comprasPage === comprasTotalPages}
                      className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">Siguiente</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Libro Ventas */}
      {activeTab === 'ventas' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Libro de Ventas</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {MONTHS.find(m => m.value === month)?.label} {year} — {ventasTotal} registro(s)
              </p>
            </div>
            <button onClick={handleExport} disabled={exporting || ventasLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
              <ArrowDownTrayIcon className="w-4 h-4" />
              {exporting ? 'Exportando...' : 'Exportar Excel'}
            </button>
          </div>
          {ventasLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
            </div>
          ) : ventas.length === 0 ? (
            <p className="px-6 py-12 text-center text-gray-400 text-sm">No hay registros para este período</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">RUT Cliente</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nombre Cliente</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Folio</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Neto</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">IVA</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ventas.map((row, idx) => {
                      const sinRut = !row.rut_cliente || row.rut_cliente === 'Sin RUT'
                      return (
                        <tr key={row.id ?? idx} className={sinRut ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                          <td className={`px-4 py-3 font-mono text-xs ${sinRut ? 'text-yellow-700 font-semibold' : 'text-gray-600'}`}>
                            {sinRut ? 'Sin RUT' : row.rut_cliente}
                          </td>
                          {/* FIX: usar nombre_cliente (campo real del backend) */}
                          <td className="px-4 py-3 text-gray-900">{row.nombre_cliente || row.razon_social || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{row.folio || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{row.fecha || '—'}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(row.neto)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(row.iva)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(row.total)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {ventasTotalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
                  <span>Página {ventasPage} de {ventasTotalPages}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setVentasPage(p => Math.max(1, p - 1))} disabled={ventasPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">Anterior</button>
                    <button onClick={() => setVentasPage(p => Math.min(ventasTotalPages, p + 1))} disabled={ventasPage === ventasTotalPages}
                      className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">Siguiente</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Resumen */}
      {activeTab === 'resumen' && (
        <div className="space-y-4">
          {resumenLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
            </div>
          ) : !resumen ? (
            <p className="text-center text-gray-400 py-12 text-sm">No hay datos para este período</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <ResumenCard
                  label="Compras Netas"
                  value={formatCurrency(resumen.total_compras_netas)}
                  variacion={resumen.variacion_compras}
                  anterior={resumen.total_compras_netas_anterior}
                  tooltip="Suma de los montos netos (sin IVA) de todas las facturas de proveedores completadas en el período."
                />
                <ResumenCard
                  label="Ventas Netas"
                  value={formatCurrency(resumen.total_ventas_netas)}
                  variacion={resumen.variacion_ventas}
                  anterior={resumen.total_ventas_netas_anterior}
                  tooltip="Suma de los montos netos (sin IVA) de todas las cotizaciones aprobadas en el período."
                />
                <ResumenCard
                  label="IVA Soportado (Compras)"
                  value={formatCurrency(resumen.iva_soportado)}
                  tooltip="IVA pagado a los proveedores en las facturas de compra. Este monto se puede descontar del IVA débito."
                />
                <ResumenCard
                  label="IVA Débito (Ventas)"
                  value={formatCurrency(resumen.iva_debito)}
                  tooltip="IVA cobrado a los clientes en las cotizaciones aprobadas. Este monto se debe declarar al SII."
                />

                {/* Resultado IVA */}
                {resumen.resultado_iva !== undefined && (
                  <div className={`rounded-xl border shadow-sm p-5 sm:col-span-2 lg:col-span-2 ${
                    Number(resumen.resultado_iva) > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center gap-1 mb-1">
                      <p className={`text-xs font-semibold uppercase tracking-widest ${
                        Number(resumen.resultado_iva) > 0 ? 'text-red-500' : 'text-green-600'
                      }`}>
                        {Number(resumen.resultado_iva) > 0 ? 'IVA a pagar al SII' : 'IVA a recuperar'}
                      </p>
                      <div className="relative group">
                        <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
                        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed hidden group-hover:block pointer-events-none">
                          Resultado = IVA Débito − IVA Soportado. Si es positivo debes pagar la diferencia al SII. Si es negativo, el SII te debe devolver ese monto.
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                        </div>
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${
                      Number(resumen.resultado_iva) > 0 ? 'text-red-700' : 'text-green-700'
                    }`}>
                      {formatCurrency(Math.abs(resumen.resultado_iva))}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      IVA Débito ({formatCurrency(resumen.iva_debito)}) − IVA Soportado ({formatCurrency(resumen.iva_soportado)})
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
