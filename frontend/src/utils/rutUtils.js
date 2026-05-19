/**
 * Formatea un RUT chileno mientras se escribe.
 * Ejemplo: 172816061 → 17.281.606-1
 */
export function formatRut(value) {
  let clean = value.replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length === 0) return ''
  const dv = clean.slice(-1)
  const body = clean.slice(0, -1)
  if (body.length === 0) return clean
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${formatted}-${dv}`
}

/**
 * Valida un RUT chileno verificando el dígito verificador.
 * Acepta formatos: 12.345.678-9, 12345678-9, 123456789
 */
export function validateRut(rut) {
  if (!rut || typeof rut !== 'string') return false
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase()
  if (clean.length < 2 || clean.length > 9) return false
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  let sum = 0
  let multiplier = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }
  const remainder = 11 - (sum % 11)
  let expectedDv = ''
  if (remainder === 11) expectedDv = '0'
  else if (remainder === 10) expectedDv = 'K'
  else expectedDv = String(remainder)
  return dv === expectedDv
}
