/**
 * PriceVariationBadge - Badge component showing price variation with color coding.
 *
 * - Positive variation (price went up): RED badge with arrow UP (↑)
 * - Negative variation (price went down): GREEN badge with arrow DOWN (↓)
 * - Zero or null variation: GRAY badge with "Sin cambio"
 *
 * Props:
 *   variacion  - number | null | undefined — the percentage variation
 *   className  - string (optional) — extra Tailwind classes
 */
export default function PriceVariationBadge({ variacion, className = '' }) {
  const value = variacion !== null && variacion !== undefined ? Number(variacion) : null

  if (value === null || isNaN(value) || value === 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 ${className}`}
      >
        Sin cambio
      </span>
    )
  }

  if (value > 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 ${className}`}
      >
        ↑ +{value.toFixed(1)}%
      </span>
    )
  }

  // variacion < 0
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 ${className}`}
    >
      ↓ {value.toFixed(1)}%
    </span>
  )
}
