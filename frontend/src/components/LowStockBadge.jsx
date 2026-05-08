import { useState, useEffect } from 'react'
import api from '../services/api'

const POLL_INTERVAL = 30_000

async function fetchLowStockCount(setter, cancelRef) {
  try {
    const res = await api.get('/inventory/low-stock/count/')
    if (!cancelRef.cancelled) setter(res.data?.count ?? 0)
  } catch {
    if (!cancelRef.cancelled) setter(0)
  }
}

export default function LowStockBadge() {
  const [count, setCount] = useState(null)

  useEffect(() => {
    const cancelRef = { cancelled: false }

    // Carga inicial
    fetchLowStockCount(setCount, cancelRef)

    // Polling cada 30s
    const interval = setInterval(() => {
      if (!document.hidden) fetchLowStockCount(setCount, cancelRef)
    }, POLL_INTERVAL)

    // Refresca cuando la pestaña vuelve a estar visible
    const onVisible = () => {
      if (!document.hidden) fetchLowStockCount(setCount, cancelRef)
    }
    document.addEventListener('visibilitychange', onVisible)

    // Escucha el evento global que dispara Products al guardar stock mínimo
    const onStockChanged = () => fetchLowStockCount(setCount, cancelRef)
    window.addEventListener('stock:changed', onStockChanged)

    return () => {
      cancelRef.cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('stock:changed', onStockChanged)
    }
  }, [])

  if (count === null) return null

  if (count === 0) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-green-400 ml-1"
        title="Stock OK"
      />
    )
  }

  return (
    <span
      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full ml-1"
      title={`${count} ítem(s) con stock bajo`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
