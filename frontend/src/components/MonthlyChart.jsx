import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const formatCurrency = (value) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(value)

const BAR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1',
  '#14b8a6', '#f43f5e',
]

/**
 * MonthlyChart — bar chart of monthly sales totals.
 *
 * Props:
 *   data — array of { month: number, year: number, total: number }
 */
export default function MonthlyChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Sin datos para mostrar
      </div>
    )
  }

  const chartData = data.map(d => ({
    ...d,
    label: `${MONTH_NAMES[(d.month ?? 1) - 1]} ${d.year}`,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" stroke="#64748b" fontSize={11} tick={{ fill: '#64748b' }} />
        <YAxis
          stroke="#64748b"
          fontSize={11}
          tickFormatter={(v) => new Intl.NumberFormat('es-CL', { notation: 'compact', currency: 'CLP' }).format(v)}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(value), 'Ventas']}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
        />
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${entry.month}-${entry.year}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
