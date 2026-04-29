const STATUS_CONFIG = {
  draft:    { label: 'Borrador',  className: 'bg-gray-100 text-gray-700' },
  sent:     { label: 'Enviada',   className: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Aprobada',  className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rechazada', className: 'bg-red-100 text-red-700' },
}

export default function QuoteStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
