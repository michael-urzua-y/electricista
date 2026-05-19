import { useState, useEffect } from 'react'
import api from '../services/api'
import MonthPicker from '../components/MonthPicker'

function formatCLP(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return '$0'
  return '$' + num.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function InfoRow({ label, value, highlight, negative }) {
  const valueClass = highlight
    ? 'text-yellow-600 text-lg'
    : negative
      ? 'text-green-600'
      : 'text-gray-900'
  return (
    <div className={`flex items-center justify-between py-3 px-4 ${highlight ? 'bg-yellow-50 rounded-lg' : ''}`}>
      <span className={`text-sm ${highlight ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm font-semibold ${valueClass}`}>{formatCLP(value)}</span>
    </div>
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

  // Load available months on mount
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

  const handleMonthChange = ({ year, month }) => {
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Estimador Tributario</h1>
          <p className="text-gray-500 mt-1">Estimación de impuestos mensuales</p>
        </div>
        <MonthPicker
          value={{ year: selectedYear, month: selectedMonth }}
          onChange={handleMonthChange}
          availableMonths={availableMonths}
        />
      </div>

      {/* Period badge */}
      <div className="bg-gray-900 rounded-xl px-6 py-4 flex items-center justify-between">
        <span className="text-white font-medium">Período</span>
        <div className="flex items-center gap-3">
          <span className="text-yellow-400 text-xl font-bold">{data.periodo}</span>
          {!data.is_current_month && (
            <span className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded-full">Histórico</span>
          )}
        </div>
      </div>

      {/* Tarjeta informativa de fechas */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-shrink-0 text-2xl">📅</div>
        <div className="flex-1">
          <p className="text-sm font-bold text-blue-900 mb-1">
            Este pago corresponde a <span className="text-blue-700">{data.periodo}</span> y se declara en <span className="text-blue-700">{data.mes_pago}</span>
          </p>
          <p className="text-xs text-blue-700 leading-relaxed">
            <strong>Fecha de corte con guía de despacho:</strong> {data.corte_con_guia} &nbsp;·&nbsp;
            <strong>Sin guía de despacho:</strong> {data.corte_sin_guia}
          </p>
          <p className="text-xs text-blue-600 mt-1">
            El receptor de la factura debe registrarla cuando la recibe. Las facturas emitidas con fecha anterior son válidas hasta los plazos indicados.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* VENTAS */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 bg-gray-900 flex items-center justify-between">
            <h2 className="text-lg font-bold text-yellow-400">📈 Ventas</h2>
            <span className="bg-yellow-500 text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full">
              {data.ventas_count} doc.
            </span>
          </div>
          <div className="p-4 space-y-1">
            <InfoRow label="Ventas Netas" value={data.ventas_netas} />
            <InfoRow label="IVA Débito (19%)" value={data.iva_debito} />
          </div>
        </div>

        {/* COMPRAS */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 bg-gray-900 flex items-center justify-between">
            <h2 className="text-lg font-bold text-yellow-400">🛒 Compras</h2>
            <span className="bg-yellow-500 text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full">
              {data.compras_count} doc.
            </span>
          </div>
          <div className="p-4 space-y-1">
            <InfoRow label="Compras Netas (Fact. Empresa)" value={data.compras_netas} />
            <InfoRow label="IVA Crédito (19%)" value={data.iva_credito} negative />
          </div>
        </div>
      </div>

      {/* IMPUESTOS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 bg-gray-900">
          <h2 className="text-lg font-bold text-yellow-400">🧾 Detalle Impuestos</h2>
        </div>
        <div className="p-4 space-y-1 divide-y divide-gray-100">
          <InfoRow label="Impuesto Determinado (IVA Débito - IVA Crédito)" value={data.impuesto_determinado} />
          <InfoRow label="PPM (1%)" value={data.ppm} />
          <InfoRow label="Retención 2da Categoría (13.75%)" value={data.retencion_2da_categoria} />
          <InfoRow label="Impuesto Trabajadores" value={data.impuesto_trabajadores} />
        </div>
      </div>

      {/* TOTALES */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 bg-gray-900">
          <h2 className="text-lg font-bold text-yellow-400">💰 Resumen</h2>
        </div>
        <div className="p-4 space-y-1 divide-y divide-gray-100">
          <InfoRow label="Total Impuesto a Pagar" value={data.total_impuesto} highlight />
          <InfoRow label="Honorarios Contador" value={data.honorarios_contador} />
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-4 px-4 bg-yellow-500 rounded-xl">
              <div>
                <span className="text-base font-bold text-gray-900 block">TOTAL A PAGAR</span>
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
