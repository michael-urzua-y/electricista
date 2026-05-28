const numberFromEnv = (name, fallback) => {
  const value = Number(import.meta.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const DEFAULT_PAGE_SIZE = numberFromEnv('VITE_DEFAULT_PAGE_SIZE', 10)
export const ACCOUNTING_PAGE_SIZE = numberFromEnv('VITE_ACCOUNTING_PAGE_SIZE', 50)
export const IVA_RATE = numberFromEnv('VITE_IVA_RATE', 0.19)
export const WORKER_HEALTH_RATE = numberFromEnv('VITE_WORKER_HEALTH_RATE', 7)
export const WORKER_UNEMPLOYMENT_RATE = numberFromEnv('VITE_WORKER_UNEMPLOYMENT_RATE', 0.6)
export const MAX_COMPANY_LOGO_MB = numberFromEnv('VITE_MAX_COMPANY_LOGO_MB', 2)

export const IVA_PERCENT_LABEL = `${Number((IVA_RATE * 100).toFixed(2)).toLocaleString('es-CL')}%`
