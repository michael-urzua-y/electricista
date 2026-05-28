import { useState, useEffect } from 'react'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import api from '../services/api'
import MonthPicker from '../components/MonthPicker'

function formatCLP(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return '$0'
  return '$' + num.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatPercent(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return '0%'
  return `${(num * 100).toLocaleString('es-CL', { maximumFractionDigits: 2 })}%`
}

function HelpTooltip({ text, placement = 'top' }) {
  const placementClass = placement === 'bottom'
    ? 'top-full mt-2'
    : 'bottom-full mb-2'

  return (
    <span className="relative inline-flex group">
      <button
        type="button"
        className="inline-flex items-center justify-center text-gray-400 hover:text-yellow-600 focus:text-yellow-600 focus:outline-none"
        aria-label={text}
      >
        <QuestionMarkCircleIcon className="w-4 h-4" />
      </button>
      <span className={`pointer-events-none absolute left-1/2 ${placementClass} z-50 w-64 -translate-x-1/2 rounded-lg border border-yellow-300 bg-white px-3 py-2 text-xs font-normal leading-relaxed text-gray-900 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100`}>
        {text}
      </span>
    </span>
  )
}

function CardTitle({ children, help }) {
  return (
    <h2 className="inline-flex items-center gap-2 text-lg font-bold text-yellow-400">
      {children}
      {help && <HelpTooltip text={help} placement="bottom" />}
    </h2>
  )
}

function InfoRow({ label, value, highlight, credit, help }) {
  const valueClass = highlight
    ? 'text-yellow-600 text-lg'
    : credit
      ? 'text-green-600'
      : 'text-gray-900'
  return (
    <div className={`flex items-center justify-between gap-4 py-3 px-4 ${highlight ? 'bg-yellow-50 rounded-lg' : ''}`}>
      <span className={`inline-flex items-center gap-1.5 text-sm ${highlight ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
        {label}
        {help && <HelpTooltip text={help} />}
      </span>
      <span className={`text-sm font-semibold text-right ${valueClass}`}>{formatCLP(value)}</span>
    </div>
  )
}

function CountBadge({ children }) {
  return (
    <span className="bg-yellow-500 text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full">
      {children}
    </span>
  )
}

export default function EstimadorTributario() {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [availableMonths, setAvailableMonths] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/estimador-tributario/meses/')
      .then(res => setAvailableMonths(res.data || []))
      .catch(() => setAvailableMonths([{ year: now.getFullYear(), month: now.getMonth() + 1 }]))
  }, [])

  const fetchData = async (month, year) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/estimador-tributario/?month=${month}&year=${year}`)
      setData(res.data)
    } catch {
      setError('No se pudo cargar el estimador tributario')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(selectedMonth, selectedYear)
  }, [selectedMonth, selectedYear])

  const handleMonthChange = (period) => {
    if (!period) return
    const { year, month } = period
    setSelectedYear(year)
    setSelectedMonth(month)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-900">Estimador Tributario</h1>
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      </div>
    )
  }

  const hasIvaRemanente = Number(data.remanente_iva_estimado) > 0

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Estimador Tributario</h1>
          <p className="text-gray-500 mt-1">Seguimiento diario del período tributario</p>
        </div>
        <MonthPicker
          value={{ year: selectedYear, month: selectedMonth }}
          onChange={handleMonthChange}
          availableMonths={availableMonths}
        />
      </div>

      <div className="bg-gray-900 rounded-xl px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="text-white font-medium">Período</span>
          <p className="text-gray-400 text-xs mt-1">{data.corte_estado_label}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-yellow-400 text-xl font-bold">{data.periodo}</span>
          {!data.is_current_month && (
            <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">Histórico</span>
          )}
        </div>
      </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-blue-900">
            Se declara en <span className="text-blue-700">{data.mes_pago}</span>
          </p>
          <p className="text-xs text-blue-700 leading-relaxed">
            Corte sin guía: {data.corte_sin_guia}. Corte con guía de despacho: {data.corte_con_guia}.
          </p>
          <p className="text-xs text-blue-600">
            Compras por recepción. Ventas como proyección hasta importar facturas emitidas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 bg-gray-900 flex items-center justify-between">
            <CardTitle help="Hoy se calculan con cotizaciones aprobadas. Sirven para anticipar el pago, pero el dato definitivo debe venir de facturas de venta electrónicas.">
              Ventas estimadas
            </CardTitle>
            <CountBadge>{data.ventas_count} cotiz.</CountBadge>
          </div>
          <div className="p-4 space-y-1">
            <InfoRow label="Neto proyectado" value={data.ventas_netas} help="Suma neta de cotizaciones aprobadas del período seleccionado." />
            <InfoRow label="IVA Débito estimado" value={data.iva_debito} help="IVA estimado sobre ventas. En F29 real debe cuadrar contra facturas emitidas." />
            <InfoRow label="Total bruto proyectado" value={data.ventas_brutas} help="Neto proyectado más IVA débito estimado." />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 bg-gray-900 flex items-center justify-between">
            <CardTitle help="Incluye facturas subidas en Compras y gastos generales marcados como factura con RUT empresa. Se ubican por fecha de recepción.">
              Compras recibidas
            </CardTitle>
            <CountBadge>{data.compras_count} doc.</CountBadge>
          </div>
          <div className="p-4 space-y-1">
            <InfoRow label={`IVA crédito compras del giro (${data.compras_giro_count})`} value={data.compras_giro_iva} credit help="IVA recuperable de facturas afectas vinculadas al giro." />
            <InfoRow label={`Facturas productos (${data.facturas_compra_count})`} value={data.compras_productos_netas} help="Facturas cargadas en Compras, usadas por fecha de recepción." />
            <InfoRow label={`Facturas gastos (${data.gastos_factura_count})`} value={data.gastos_factura_netas} help="Gastos generales con factura empresa y tipo Factura." />
            <InfoRow label={`Facturas exentas (${data.compras_exentas_count})`} value={data.compras_exentas_netas} help="Documentos exentos: suman al control mensual, pero no generan IVA crédito." />
            <InfoRow label="Remanente mes anterior" value={data.remanente_mes_anterior} credit help="Saldo de IVA crédito de meses anteriores. Por ahora queda en cero hasta registrar el remanente real." />
            <InfoRow label="Total IVA crédito fiscal" value={data.iva_credito} credit help="IVA crédito usado para rebajar el IVA débito del mes." />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 bg-gray-900">
          <CardTitle help="Resume los componentes que aparecen normalmente en el cálculo mensual del contador.">
            Detalle de impuestos
          </CardTitle>
        </div>
        <div className="p-4 space-y-1 divide-y divide-gray-100">
          <InfoRow label="Resultado IVA (débito - crédito)" value={data.resultado_iva} credit={Number(data.resultado_iva) < 0} help="Diferencia entre IVA de ventas e IVA crédito de compras." />
          {hasIvaRemanente && (
            <InfoRow label="Remanente IVA estimado" value={data.remanente_iva_estimado} credit help="Aparece cuando el IVA crédito supera al IVA débito." />
          )}
          <InfoRow label="Impuesto determinado" value={data.impuesto_determinado} help="IVA a pagar cuando el débito supera al crédito. Si hay remanente, queda en cero." />
          <InfoRow label={`PPM (${formatPercent(data.ppm_rate)})`} value={data.ppm} help="Pago provisional mensual. Hoy está configurado en 1%." />
          <InfoRow label={`Retención honorarios (${formatPercent(data.retencion_honorarios_rate)})`} value={data.retencion_2da_categoria} help="Retención calculada sobre gastos de tipo Honorario del período." />
          <InfoRow label="Impuesto trabajadores" value={data.impuesto_trabajadores} help="Suma de impuesto único estimado para trabajadores activos." />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 bg-gray-900">
          <CardTitle help="Monto final de referencia para separar caja durante el mes. No reemplaza la declaración final del contador.">
            Resumen
          </CardTitle>
        </div>
        <div className="p-4 space-y-1 divide-y divide-gray-100">
          <InfoRow label="Total impuesto a pagar" value={data.total_impuesto} highlight help="Suma de impuesto determinado, PPM, retenciones e impuesto trabajadores." />
          <InfoRow label="Honorarios contador" value={data.honorarios_contador} help="Monto fijo mensual configurado para el contador." />
          {Number(data.honorarios_renta_at) > 0 && (
            <InfoRow label={data.honorarios_renta_at_label || 'HON RENTA'} value={data.honorarios_renta_at} help="Cargo anual indicado por el contador para la renta del año tributario." />
          )}
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-4 px-4 bg-yellow-500 rounded-xl">
              <div>
                <span className="text-base font-bold text-gray-900 block">TOTAL A TRANSFERIR</span>
                <span className="text-xs text-gray-700">Pagar en {data.mes_pago}</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">{formatCLP(data.total_a_transferir)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
