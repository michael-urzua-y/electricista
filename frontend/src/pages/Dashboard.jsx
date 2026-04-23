import { useState, useEffect } from 'react'
import { CurrencyDollarIcon, DocumentTextIcon, ArrowTrendingUpIcon, CalendarIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import api from '../services/api'

export default function Dashboard() {
  const [stats, setStats] = useState({ totalInvoices: 0, totalSpent: 0, avgAmount: 0 })
  const [recentInvoices, setRecentInvoices] = useState([])
  const [comparison, setComparison] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [availableMonths, setAvailableMonths] = useState([])
  const [availableYears, setAvailableYears] = useState([])
  const [validPeriods, setValidPeriods] = useState(new Set())
  const [minPeriod, setMinPeriod] = useState('')
  const [maxPeriod, setMaxPeriod] = useState('')
  const [allInvoices, setAllInvoices] = useState([])
  const [refreshInterval, setRefreshInterval] = useState(() => {
    const stored = localStorage.getItem('dashboardRefreshInterval');
    const parsed = stored ? parseInt(stored) : null;
    return (!isNaN(parsed) && parsed > 0) ? parsed : 30000;
  })

  // Modal de detalle diario
  const [showDailyModal, setShowDailyModal] = useState(false)
  const [dailyData, setDailyData] = useState([])
  const [loadingDaily, setLoadingDaily] = useState(false)
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState('')

  useEffect(() => {
    fetchDashboardData()

    // Obtener intervalo de preferencia del usuario (default 30s para ser más conservador con recursos)
    const intervalMs = parseInt(localStorage.getItem('dashboardRefreshInterval')) || 30000
    
    // Solo hacer polling si el intervalo es mayor a 0
    if (intervalMs > 0) {
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          // Solo hacer petición si la pestaña está visible
          fetchDashboardData()
        }
      }
      
      const interval = setInterval(() => {
        // Verificar si la pestaña está visible antes de hacer la petición
        if (!document.hidden) {
          fetchDashboardData()
        }
      }, intervalMs)
      
      // Escuchar cambios de visibilidad de la pestaña
      document.addEventListener('visibilitychange', handleVisibilityChange)
      
      return () => {
        clearInterval(interval)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
    
    // Si intervalMs === 0, solo cargamos una vez (modo manual)
    return () => {}
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const invoicesRes = await api.get('/facturas/')
      const invoices = invoicesRes.data?.results || invoicesRes.data || []

      // Calcular período actual (YYYY-MM) para excluir futuros
      const now = new Date()
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const periodsSet = new Set()
      const monthsSet = new Set()
      const yearsSet = new Set()
      let minYear = Infinity, minMonth = Infinity, maxYear = -Infinity, maxMonth = -Infinity

      invoices.forEach(inv => {
        const d = new Date(inv.issue_date || inv.created_at)
        const year = d.getFullYear()
        const month = d.getMonth() + 1
        const period = `${year}-${String(month).padStart(2, '0')}`

        if (period <= currentPeriod) {
          periodsSet.add(period)
          monthsSet.add(month)
          yearsSet.add(year)

          if (year < minYear || (year === minYear && month < minMonth)) {
            minYear = year; minMonth = month
          }
          if (year > maxYear || (year === maxYear && month > maxMonth)) {
            maxYear = year; maxMonth = month
          }
        }
      })

      const minPeriod = minYear !== Infinity ? `${minYear}-${String(minMonth).padStart(2,'0')}` : ''
      const maxPeriod = maxYear !== -Infinity ? `${maxYear}-${String(maxMonth).padStart(2,'0')}` : ''

      setValidPeriods(periodsSet)
      setMinPeriod(minPeriod)
      setMaxPeriod(maxPeriod)

      const months = Array.from(monthsSet).sort((a, b) => b - a)
      const years = Array.from(yearsSet).sort((a, b) => b - a)
      setAvailableMonths(months)
      setAvailableYears(years)

      if (periodsSet.size > 0) {
        const [defYear, defMonth] = maxPeriod.split('-').map(Number)
        setSelectedYear(defYear.toString())
        setSelectedMonth(defMonth)
      } else {
        setSelectedYear('')
        setSelectedMonth('')
      }

      const compRes = await api.get('/comparacion/')
      const compData = compRes.data?.results || compRes.data
      setComparison(Array.isArray(compData) ? compData : [])

      setAllInvoices(invoices)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterInvoicesByMonth = (invoices, month, year) => {
    if (!month || !year) return invoices
    return invoices.filter(inv => {
      const d = new Date(inv.issue_date || inv.created_at)
      return d.getMonth() + 1 === parseInt(month, 10) && d.getFullYear() === parseInt(year, 10)
    })
  }

  // Recalcular stats cuando cambian mes/año o lista de facturas
  useEffect(() => {
    if (!selectedMonth || !selectedYear) return
    const filtered = filterInvoicesByMonth(allInvoices, selectedMonth, selectedYear)
    const totalInvoices = filtered.length
    const totalSpent = filtered.reduce((sum, inv) => {
      const val = parseFloat(inv.total_amount)
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
    const avgAmount = totalInvoices ? totalSpent / totalInvoices : 0
    setStats({ totalInvoices, totalSpent, avgAmount })
    setRecentInvoices(filtered.slice(0, 5))
  }, [selectedMonth, selectedYear, allInvoices])

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(value)
  }

  // Manejar cambio en el selector de mes
  const handlePeriodChange = (e) => {
    const value = e.target.value
    if (!value) return
    const [year, month] = value.split('-')
    const monthInt = parseInt(month, 10)
    const period = `${year}-${String(monthInt).padStart(2, '0')}`

    if (!validPeriods.has(period)) {
      alert('No hay facturas para este período. Seleccione un mes con datos.')
      const currentVal = selectedYear && selectedMonth ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}` : ''
      e.target.value = currentVal
      return
    }

    setSelectedYear(year)
    setSelectedMonth(monthInt)
  }

  // Obtener totales diarios para el mes seleccionado
  const fetchDailyData = async (year, month) => {
    setLoadingDaily(true)
    setShowDailyModal(true)
    try {
      const res = await api.get(`/facturas/diarios/?year=${year}&month=${month}`)
      setDailyData(Array.isArray(res.data) ? res.data : [])
    } catch (error) {
      console.error('Error fetching daily totals:', error)
      setDailyData([])
    } finally {
      setLoadingDaily(false)
    }
  }

  // Cerrar modal
  const closeDailyModal = () => {
    setShowDailyModal(false)
    setDailyData([])
  }

  // Datos para gráfico de gastos mensuales
  const monthlyData = (() => {
    if (!selectedYear) return []
    const yearNum = parseInt(selectedYear, 10)
    const data = []
    for (let m = 1; m <= 12; m++) {
      const label = new Date(yearNum, m - 1, 1).toLocaleDateString('es-CL', { month: 'short', year: 'numeric' })
      data.push({ year: yearNum, month: m, label, total: 0 })
    }
    allInvoices.forEach(inv => {
      const d = new Date(inv.issue_date || inv.created_at)
      if (d.getFullYear() === yearNum) {
        const m = d.getMonth() + 1
        const val = parseFloat(inv.total_amount)
        const safeVal = isNaN(val) ? 0 : val
        const entry = data.find(e => e.month === m)
        if (entry) entry.total += safeVal
      }
    })
    return data
  })()

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
    '#14b8a6', '#f43f5e', '#22c55e', '#eab308', '#a855f7',
    '#06b6d4', '#f97316', '#84cc16', '#ef4444', '#3b82f6'
  ]

  const providerData = recentInvoices.reduce((acc, inv) => {
    const prov = inv.provider_name || 'Sin proveedor'
    const existing = acc.find(item => item.name === prov)
    const val = parseFloat(inv.total_amount)
    const safeVal = isNaN(val) ? 0 : val
    if (existing) {
      existing.value += safeVal
    } else {
      acc.push({ name: prov, value: safeVal })
    }
    return acc
  }, [])

  const statCards = [
    { title: 'Total Facturas', value: stats.totalInvoices, icon: DocumentTextIcon, color: 'bg-blue-500', lightColor: 'bg-blue-50', textColor: 'text-blue-700' },
    { title: 'Gasto Total', value: formatCurrency(stats.totalSpent), icon: CurrencyDollarIcon, color: 'bg-green-500', lightColor: 'bg-green-50', textColor: 'text-green-700' },
    { title: 'Promedio por Factura', value: formatCurrency(stats.avgAmount), icon: ArrowTrendingUpIcon, color: 'bg-orange-500', lightColor: 'bg-orange-50', textColor: 'text-orange-700' },
    { title: 'Productos Comparados', value: comparison.length, icon: CurrencyDollarIcon, color: 'bg-purple-500', lightColor: 'bg-purple-50', textColor: 'text-purple-700' }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 mt-1">Resumen de compras y precios</p>
          </div>
           {/* Selector de mes/año + botón refrescar + configuración de actualización */}
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
               <CalendarIcon className="w-5 h-5 text-gray-400" />
               <label className="text-sm font-medium text-gray-700">Período:</label>
               <input
                 type="month"
                 value={selectedYear && selectedMonth ? `${selectedYear}-${String(selectedMonth).padStart(2, '0')}` : ''}
                 onChange={handlePeriodChange}
                 min={minPeriod}
                 max={maxPeriod}
                 disabled={!minPeriod}
                 className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
               />
             </div>
             
             {/* Configuración de actualización automática */}
             <div className="flex items-center gap-2">
               <label className="text-sm font-medium text-gray-700">Actualización:</label>
               <select
                 value={refreshInterval === 0 ? 'manual' : refreshInterval/1000}
                 onChange={(e) => {
                   const newInterval = parseInt(e.target.value) * 1000;
                   setRefreshInterval(newInterval);
                   localStorage.setItem('dashboardRefreshInterval', newInterval.toString());
                 }}
                 className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
               >
                 <option value="0">Manual</option>
                 <option value="5">5s</option>
                 <option value="10">10s</option>
                 <option value="15">15s</option>
                 <option value="30">30s</option>
                 <option value="60">1min</option>
               </select>
             </div>
             
             <button
               onClick={fetchDashboardData}
               disabled={loading}
               className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
               title="Actualizar datos"
             >
               <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
             </button>
           </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, idx) => (
            <div key={idx} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.lightColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly spending */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Gasto Mensual</h3>
            <div className="h-64">
              {monthlyData.length > 0 ? (
                <ResponsiveContainer key={`monthly-${selectedYear}-${selectedMonth}`} width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Bar
                      dataKey="total"
                      radius={[4, 4, 0, 0]}
                      onClick={(entry) => {
                        if (entry && entry.year && entry.month) {
                          setSelectedPeriodLabel(entry.label)
                          fetchDailyData(entry.year, entry.month)
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {monthlyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">No hay datos suficientes</div>
              )}
            </div>
          </div>

          {/* Provider distribution */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribución por Proveedor</h3>
            <div className="h-64">
              {providerData.length > 0 ? (
                <ResponsiveContainer key={`provider-${selectedYear}-${selectedMonth}`} width="100%" height="100%">
                  <BarChart data={providerData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" fontSize={12} />
                    <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} width={100} />
                    <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {providerData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">No hay datos de proveedores</div>
              )}
            </div>
          </div>
        </div>

        {/* Recent invoices and price summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent invoices */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Últimas Facturas</h3>
            {recentInvoices.length > 0 ? (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{invoice.invoice_number || `Factura #${invoice.id}`}</p>
                      <p className="text-xs text-gray-500">{new Date(invoice.issue_date || invoice.created_at).toLocaleDateString('es-CL')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(invoice.total_amount)}</p>
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                        invoice.status === 'completed' ? 'bg-green-100 text-green-700' :
                        invoice.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                        invoice.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">No hay facturas en este período</p>
            )}
          </div>

          {/* Price comparison summary */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen de Precios</h3>
            {comparison.length > 0 ? (
              <div className="space-y-3">
                {comparison.slice(0, 5).map((comp) => (
                  <div key={comp.product_id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{comp.product_name}</p>
                      <p className="text-xs text-gray-500">Mejor: {comp.best_provider} ({formatCurrency(comp.best_price)})</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{Object.keys(comp.prices).length} proveedor(es)</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">No hay productos con precios</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal de detalle diario */}
      {showDailyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Detalle Diario - {selectedPeriodLabel}</h2>
                <p className="text-sm text-gray-500">Totales por día</p>
              </div>
              <button onClick={closeDailyModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              {loadingDaily ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                </div>
              ) : dailyData.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                      <YAxis stroke="#64748b" fontSize={12} />
                      <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {dailyData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-400">No hay datos diarios para este mes</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
