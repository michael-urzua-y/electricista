import { useState, useEffect, useCallback, useMemo } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, XMarkIcon, InformationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { getWorkers, createWorker, updateWorker, deleteWorker, getUfValue } from '../services/workersApi'

function formatCLP(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return '$0'
  return '$' + num.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatDateCL(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function InfoTooltip({ text }) {
  return (
    <span className="relative inline-flex group">
      <InformationCircleIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg group-hover:block">
        {text}
      </span>
    </span>
  )
}

function WorkerFormModal({ worker, onClose, onSuccess }) {
  const isEditing = Boolean(worker)

  const [form, setForm] = useState({
    name: '',
    rut: '',
    position: '',
    gross_salary: '',
    gratification: '0',
    meal_allowance: '0',
    transport_allowance: '0',
    other_allowance: '0',
    additional_health: '0',
    health_system: 'fonasa',
    health_plan_unit: 'uf',
    health_plan_uf: '0',
    health_plan_clp: '0',
    health_uf_value: '0',
    afp_rate: '10.69',
    health_rate: '7.00',
    unemployment_rate: '0.60',
    is_active: true,
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [ufLoading, setUfLoading] = useState(false)
  const [ufError, setUfError] = useState('')
  const [ufInfo, setUfInfo] = useState(null)

  useEffect(() => {
    if (worker) {
      const fmt = (val) => {
        const n = Math.round(Number(val) || 0)
        return n === 0 ? '0' : n.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      }
      const healthSystem = worker.health_system || (Number(worker.additional_health) > 0 ? 'isapre' : 'fonasa')
      const healthPlanUnit = worker.health_plan_unit === 'manual' ? 'clp' : (worker.health_plan_unit || 'uf')
      const legacyPlanClp = Number(worker.health_plan_clp) > 0
        ? worker.health_plan_clp
        : worker.health_total_amount
      setForm({
        name: worker.name || '',
        rut: worker.rut || '',
        position: worker.position || '',
        gross_salary: worker.gross_salary ? fmt(worker.gross_salary) : '',
        gratification: fmt(worker.gratification),
        meal_allowance: fmt(worker.meal_allowance),
        transport_allowance: fmt(worker.transport_allowance),
        other_allowance: fmt(worker.other_allowance),
        additional_health: fmt(worker.additional_health),
        health_system: healthSystem,
        health_plan_unit: healthPlanUnit,
        health_plan_uf: worker.health_plan_uf?.toString() || '0',
        health_plan_clp: fmt(legacyPlanClp),
        health_uf_value: worker.health_uf_value?.toString() || '0',
        afp_rate: worker.afp_rate?.toString() || '10.69',
        health_rate: '7.00',
        unemployment_rate: worker.unemployment_rate?.toString() || '0.60',
        is_active: worker.is_active ?? true,
      })
    }
  }, [worker])

  // --- RUT helpers ---
  const formatRut = (raw) => {
    // Remove everything except digits and kK
    let clean = raw.replace(/[^0-9kK]/g, '').toUpperCase()
    if (clean.length === 0) return ''
    // Separate body and verifier
    const dv = clean.slice(-1)
    const body = clean.slice(0, -1)
    if (body.length === 0) return clean
    // Add dots
    const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `${formatted}-${dv}`
  }

  const validateRut = (rut) => {
    const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase()
    if (clean.length < 2) return false
    const body = clean.slice(0, -1)
    const dv = clean.slice(-1)
    // Calculate expected DV
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

  const handleRutChange = (e) => {
    const formatted = formatRut(e.target.value)
    setForm((prev) => ({ ...prev, rut: formatted }))
    if (errors.rut) setErrors((prev) => ({ ...prev, rut: '' }))
  }

  const handleRutBlur = () => {
    if (form.rut && !validateRut(form.rut)) {
      setErrors((prev) => ({ ...prev, rut: 'RUT inválido' }))
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const normalizeMoneyDigits = (raw) => String(raw).replace(/\D/g, '').replace(/^0+(?=\d)/, '')

  // Format number with dot thousands separator for display
  const formatMoneyDisplay = (raw) => {
    const digits = normalizeMoneyDigits(raw)
    if (!digits) return ''
    return Number(digits).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  // Strip formatting to get raw number for backend
  const stripMoneyFormat = (formatted) => normalizeMoneyDigits(formatted)

  const normalizeDecimal = (raw) => String(raw || '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '')
    .replace(/(\..*)\./g, '$1')

  const decimalNumber = (raw) => {
    const parsed = Number(normalizeDecimal(raw))
    return Number.isFinite(parsed) ? parsed : 0
  }

  const handleDecimalChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value.replace(',', '.') }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  // For integer money fields - format with thousands separator
  const handleMoneyChange = (e) => {
    const { name, value } = e.target
    const formatted = formatMoneyDisplay(value)
    setForm((prev) => ({ ...prev, [name]: formatted }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const fetchUfValue = useCallback(async () => {
    if (ufLoading) return
    setUfLoading(true)
    setUfError('')
    try {
      const res = await getUfValue()
      const value = Number(res.data?.value)
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Valor UF inválido')
      }
      setForm((prev) => ({ ...prev, health_uf_value: value.toFixed(2) }))
      setUfInfo({
        date: res.data?.date,
        source: res.data?.source,
        stale: Boolean(res.data?.stale),
      })
    } catch {
      setUfError('No se pudo actualizar la UF. Puedes ingresarla manualmente.')
    } finally {
      setUfLoading(false)
    }
  }, [ufLoading])

  const handleHealthSystemChange = (healthSystem) => {
    setForm((prev) => ({
      ...prev,
      health_system: healthSystem,
      health_rate: '7.00',
      additional_health: '0',
      health_plan_unit: healthSystem === 'isapre'
        ? (prev.health_plan_unit === 'clp' ? 'clp' : 'uf')
        : 'uf',
    }))
  }

  const handleHealthPlanUnitChange = (healthPlanUnit) => {
    setForm((prev) => ({ ...prev, health_plan_unit: healthPlanUnit }))
  }

  useEffect(() => {
    const shouldFetchUf = form.health_system === 'isapre'
      && form.health_plan_unit === 'uf'
      && decimalNumber(form.health_uf_value) <= 0
      && !ufLoading
      && !ufError

    if (shouldFetchUf) {
      fetchUfValue()
    }
  }, [form.health_system, form.health_plan_unit, form.health_uf_value, fetchUfValue, ufLoading, ufError])

  const payrollPreview = useMemo(() => {
    const money = (name) => Number(stripMoneyFormat(form[name]) || 0)
    const taxableBase = money('gross_salary') + money('gratification')
    const afpAmount = Math.round(taxableBase * decimalNumber(form.afp_rate) / 100)
    const legalHealth = Math.round(taxableBase * decimalNumber(form.health_rate) / 100)
    const unemploymentAmount = Math.round(taxableBase * decimalNumber(form.unemployment_rate) / 100)

    let planAmount = 0
    let additionalHealth = 0
    if (form.health_system === 'isapre') {
      if (form.health_plan_unit === 'uf') {
        planAmount = Math.round(decimalNumber(form.health_plan_uf) * decimalNumber(form.health_uf_value))
        additionalHealth = Math.max(planAmount - legalHealth, 0)
      } else {
        planAmount = money('health_plan_clp')
        additionalHealth = Math.max(planAmount - legalHealth, 0)
      }
    }

    const totalHealth = legalHealth + additionalHealth
    return {
      taxableBase,
      afpAmount,
      legalHealth,
      planAmount,
      additionalHealth,
      totalHealth,
      unemploymentAmount,
      deductionsAmount: afpAmount + totalHealth + unemploymentAmount,
    }
  }, [form])

  const validate = () => {
    const newErrors = {}
    if (!form.name.trim()) newErrors.name = 'El nombre es obligatorio'
    if (form.rut && !validateRut(form.rut)) newErrors.rut = 'RUT inválido'
    const rawSalary = stripMoneyFormat(form.gross_salary)
    if (!rawSalary) {
      newErrors.gross_salary = 'El sueldo bruto es obligatorio'
    } else if (Number.isNaN(Number(rawSalary)) || Number(rawSalary) <= 0) {
      newErrors.gross_salary = 'El sueldo debe ser un número mayor a cero'
    }
    const afp = parseFloat(form.afp_rate)
    if (Number.isNaN(afp) || afp < 0 || afp > 30) newErrors.afp_rate = 'Debe estar entre 0 y 30'
    const health = parseFloat(form.health_rate)
    if (Number.isNaN(health) || health < 0 || health > 30) newErrors.health_rate = 'Debe estar entre 0 y 30'
    const unemp = parseFloat(form.unemployment_rate)
    if (Number.isNaN(unemp) || unemp < 0 || unemp > 10) newErrors.unemployment_rate = 'Debe estar entre 0 y 10'
    if (form.health_system === 'isapre' && form.health_plan_unit === 'uf') {
      if (decimalNumber(form.health_plan_uf) <= 0) newErrors.health_plan_uf = 'Ingresa las UF del plan'
      if (decimalNumber(form.health_uf_value) <= 0) newErrors.health_uf_value = 'Ingresa el valor UF'
    }
    if (form.health_system === 'isapre' && form.health_plan_unit === 'clp') {
      const planClp = Number(stripMoneyFormat(form.health_plan_clp) || 0)
      if (planClp <= 0) newErrors.health_plan_clp = 'Ingresa el valor del plan'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!validate()) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        rut: form.rut.trim() || null,
        position: form.position.trim() || null,
        gross_salary: stripMoneyFormat(form.gross_salary) || '0',
        gratification: stripMoneyFormat(form.gratification) || '0',
        meal_allowance: stripMoneyFormat(form.meal_allowance) || '0',
        transport_allowance: stripMoneyFormat(form.transport_allowance) || '0',
        other_allowance: stripMoneyFormat(form.other_allowance) || '0',
        additional_health: '0',
        health_system: form.health_system,
        health_plan_unit: form.health_plan_unit,
        health_plan_uf: normalizeDecimal(form.health_plan_uf) || '0',
        health_plan_clp: stripMoneyFormat(form.health_plan_clp) || '0',
        health_uf_value: normalizeDecimal(form.health_uf_value) || '0',
        afp_rate: form.afp_rate,
        health_rate: form.health_rate,
        unemployment_rate: form.unemployment_rate,
        is_active: form.is_active,
      }

      if (isEditing) {
        await updateWorker(worker.id, payload)
        onSuccess('Trabajador actualizado correctamente')
      } else {
        await createWorker(payload)
        onSuccess('Trabajador creado correctamente')
      }
    } catch (err) {
      const data = err.response?.data
      if (data) {
        const fieldErrors = {}
        Object.keys(data).forEach((key) => {
          if (key !== 'non_field_errors' && key !== 'detail') {
            fieldErrors[key] = Array.isArray(data[key]) ? data[key][0] : data[key]
          }
        })
        setErrors(fieldErrors)
        const generalMsg = data.detail || data.non_field_errors?.[0] || ''
        if (generalMsg) setFormError(generalMsg)
        else if (Object.keys(fieldErrors).length === 0) setFormError('Error al guardar')
      } else {
        setFormError('Error al guardar el trabajador')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 animate-fade-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? 'Editar Trabajador' : 'Nuevo Trabajador'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {formError}
            </div>
          )}

          {/* Datos personales */}
          <div className="space-y-4">
            {/* Nombre */}
            <div>
              <label htmlFor="worker-name" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                id="worker-name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="Nombre completo"
                required
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
            </div>

            {/* RUT y Cargo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="worker-rut" className="block text-sm font-medium text-gray-700 mb-1">RUT</label>
                <input
                  id="worker-rut"
                  name="rut"
                  type="text"
                  value={form.rut}
                  onChange={handleRutChange}
                  onBlur={handleRutBlur}
                  placeholder="12.345.678-9"
                  maxLength={12}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 ${errors.rut ? 'border-red-400' : 'border-gray-300'}`}
                />
                {errors.rut && <p className="mt-1 text-xs text-red-500">{errors.rut}</p>}
              </div>
              <div>
                <label htmlFor="worker-position" className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                <input
                  id="worker-position"
                  name="position"
                  type="text"
                  value={form.position}
                  onChange={handleChange}
                  placeholder="Ej: Electricista"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>
          </div>

          {/* Haberes Imponibles */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 pb-1 border-b border-yellow-400">
              Haberes Imponibles
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="worker-salary" className="block text-sm font-medium text-gray-700 mb-1">
                  Sueldo Base <span className="text-red-500">*</span>
                </label>
                <input
                  id="worker-salary"
                  name="gross_salary"
                  type="text"
                  inputMode="numeric"
                  value={form.gross_salary}
                  onChange={handleMoneyChange}
                  placeholder="Ej: 800000"
                  required
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 ${errors.gross_salary ? 'border-red-400' : 'border-gray-300'}`}
                />
                {errors.gross_salary && <p className="mt-1 text-xs text-red-500">{errors.gross_salary}</p>}
              </div>
              <div>
                <label htmlFor="worker-gratification" className="block text-sm font-medium text-gray-700 mb-1">
                  Gratificación
                </label>
                <input
                  id="worker-gratification"
                  name="gratification"
                  type="text"
                  inputMode="numeric"
                  value={form.gratification}
                  onChange={handleMoneyChange}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>
          </div>

          {/* Haberes No Imponibles */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 pb-1 border-b border-yellow-400">
              Haberes No Imponibles
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="worker-meal" className="block text-sm font-medium text-gray-700 mb-1">
                  Colación
                </label>
                <input
                  id="worker-meal"
                  name="meal_allowance"
                  type="text"
                  inputMode="numeric"
                  value={form.meal_allowance}
                  onChange={handleMoneyChange}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label htmlFor="worker-transport" className="block text-sm font-medium text-gray-700 mb-1">
                  Movilización
                </label>
                <input
                  id="worker-transport"
                  name="transport_allowance"
                  type="text"
                  inputMode="numeric"
                  value={form.transport_allowance}
                  onChange={handleMoneyChange}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label htmlFor="worker-other" className="block text-sm font-medium text-gray-700 mb-1">
                  Otras
                </label>
                <input
                  id="worker-other"
                  name="other_allowance"
                  type="text"
                  inputMode="numeric"
                  value={form.other_allowance}
                  onChange={handleMoneyChange}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>
          </div>

          {/* Tasas de Descuento */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 pb-1 border-b border-yellow-400">
              Descuentos Previsionales
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="worker-afp" className="block text-sm font-medium text-gray-700 mb-1">% AFP</label>
                <input
                  id="worker-afp"
                  name="afp_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.afp_rate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
              <div>
                <label htmlFor="worker-health" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  % Salud legal
                  <InfoTooltip text="La cotización legal de salud es 7%. En Isapre, el plan puede costar más y la diferencia se calcula aparte." />
                </label>
                <input
                  id="worker-health"
                  name="health_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.health_rate}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <label htmlFor="worker-unemployment" className="block text-sm font-medium text-gray-700 mb-1">% Cesantía</label>
                <input
                  id="worker-unemployment"
                  name="unemployment_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unemployment_rate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-gray-800">Sistema de salud</span>
                  <InfoTooltip text="Fonasa usa solo el 7% legal. Isapre calcula la diferencia entre ese 7% y el valor pactado del plan." />
                </div>
                <div className="grid grid-cols-2 rounded-lg border border-gray-300 bg-white p-0.5">
                  {[
                    ['fonasa', 'Fonasa'],
                    ['isapre', 'Isapre'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleHealthSystemChange(value)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                        form.health_system === value
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {form.health_system === 'isapre' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 rounded-lg border border-gray-300 bg-white p-0.5">
                    {[
                      ['uf', 'UF'],
                      ['clp', 'Pesos'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleHealthPlanUnitChange(value)}
                        className={`px-2 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                          form.health_plan_unit === value
                            ? 'bg-yellow-500 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {form.health_plan_unit === 'uf' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="worker-health-plan-uf" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                          Plan UF
                          <InfoTooltip text="Usa las UF pactadas del plan. En una liquidación suele aparecer como 3.184 UF o similar." />
                        </label>
                        <input
                          id="worker-health-plan-uf"
                          name="health_plan_uf"
                          type="text"
                          inputMode="decimal"
                          value={form.health_plan_uf}
                          onChange={handleDecimalChange}
                          placeholder="3.184"
                          className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 ${errors.health_plan_uf ? 'border-red-400' : 'border-gray-300'}`}
                        />
                        {errors.health_plan_uf && <p className="mt-1 text-xs text-red-500">{errors.health_plan_uf}</p>}
                      </div>
                      <div>
                        <label htmlFor="worker-health-uf-value" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                          Valor UF hoy
                          <InfoTooltip text="Se actualiza desde mindicador.cl y queda disponible para calcular el plan del día." />
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="worker-health-uf-value"
                            name="health_uf_value"
                            type="text"
                            inputMode="decimal"
                            value={form.health_uf_value}
                            onChange={handleDecimalChange}
                            readOnly={!ufError}
                            placeholder="39841.72"
                            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                              errors.health_uf_value
                                ? 'border-red-400'
                                : ufError
                                  ? 'border-yellow-400 bg-white'
                                  : 'border-gray-200 bg-gray-100 text-gray-700'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={fetchUfValue}
                            disabled={ufLoading}
                            title="Actualizar UF"
                            className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <ArrowPathIcon className={`w-4 h-4 ${ufLoading ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                        {ufInfo && !ufError && (
                          <p className="mt-1 text-xs text-gray-500">
                            {ufInfo.stale ? 'Último valor disponible' : 'Actualizado'} {formatDateCL(ufInfo.date)}
                            {ufInfo.source ? ` · ${ufInfo.source}` : ''}
                          </p>
                        )}
                        {ufError && <p className="mt-1 text-xs text-yellow-700">{ufError}</p>}
                        {errors.health_uf_value && <p className="mt-1 text-xs text-red-500">{errors.health_uf_value}</p>}
                      </div>
                    </div>
                  )}

                  {form.health_plan_unit === 'clp' && (
                    <div>
                      <label htmlFor="worker-health-plan-clp" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                        Plan salud $
                        <InfoTooltip text="Ingresa el valor total del plan pactado. La diferencia Isapre se calcula restando la cotización legal." />
                      </label>
                      <input
                        id="worker-health-plan-clp"
                        name="health_plan_clp"
                        type="text"
                        inputMode="numeric"
                        value={form.health_plan_clp}
                        onChange={handleMoneyChange}
                        placeholder="0"
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 ${errors.health_plan_clp ? 'border-red-400' : 'border-gray-300'}`}
                      />
                      {errors.health_plan_clp && <p className="mt-1 text-xs text-red-500">{errors.health_plan_clp}</p>}
                    </div>
                  )}

                </div>
              )}

              {form.health_system === 'fonasa' ? (
                <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                  <p className="text-[11px] font-medium text-gray-500">Cotización Fonasa 7%</p>
                  <p className="text-sm font-bold text-gray-900">{formatCLP(payrollPreview.legalHealth)}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                    <p className="text-[11px] font-medium text-gray-500">7% legal</p>
                    <p className="text-sm font-bold text-gray-900">{formatCLP(payrollPreview.legalHealth)}</p>
                  </div>
                  <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                    <p className="text-[11px] font-medium text-gray-500">Plan Isapre</p>
                    <p className="text-sm font-bold text-gray-900">{formatCLP(payrollPreview.planAmount || payrollPreview.legalHealth)}</p>
                  </div>
                  <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                    <p className="text-[11px] font-medium text-gray-500">Diferencia Isapre</p>
                    <p className="text-sm font-bold text-gray-900">{formatCLP(payrollPreview.additionalHealth)}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 mt-3">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  Base tributable
                  <InfoTooltip text="Base imponible menos AFP, salud completa y seguro de cesantía. Es el valor usado para estimar el impuesto único." />
                </label>
                <div className="w-full px-3 py-2 rounded-lg text-sm bg-gray-100 border border-gray-200 text-gray-900 font-semibold">
                  {formatCLP(Math.max(payrollPreview.taxableBase - payrollPreview.deductionsAmount, 0))}
                </div>
              </div>
            </div>
          </div>

          {/* Activo */}
          <div className="flex items-center gap-3">
            <input
              id="worker-active"
              name="is_active"
              type="checkbox"
              checked={form.is_active}
              onChange={handleChange}
              className="w-4 h-4 text-yellow-500 border-gray-300 rounded focus:ring-yellow-400"
            />
            <label htmlFor="worker-active" className="text-sm font-medium text-gray-700">
              Trabajador activo
            </label>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Trabajador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Trabajadores() {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingWorker, setEditingWorker] = useState(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const fetchWorkers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getWorkers()
      const data = res.data?.results ?? res.data ?? []
      setWorkers(data)
    } catch {
      setError('No se pudieron cargar los trabajadores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkers()
  }, [fetchWorkers])

  const showSuccess = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  const handleDelete = async (worker) => {
    if (!globalThis.confirm(`¿Eliminar a "${worker.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteWorker(worker.id)
      showSuccess('Trabajador eliminado correctamente')
      fetchWorkers()
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo eliminar el trabajador')
    }
  }

  const handleEdit = (worker) => {
    setEditingWorker(worker)
    setShowForm(true)
  }

  const handleNew = () => {
    setEditingWorker(null)
    setShowForm(true)
  }

  const activeWorkers = workers.filter((w) => w.is_active)
  const inactiveWorkers = workers.filter((w) => !w.is_active)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trabajadores</h1>
          <p className="text-gray-500 mt-1">Gestión de personal y cálculo de remuneraciones</p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Nuevo Trabajador
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>
      )}
      {successMsg && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{successMsg}</div>
      )}

      {/* Summary */}
      {!loading && workers.length > 0 && (
        <div className="bg-gray-900 rounded-xl px-6 py-4 flex items-center justify-between">
          <span className="text-white font-medium">Total Trabajadores Activos</span>
          <span className="text-yellow-400 text-xl font-bold">{activeWorkers.length}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500" />
        </div>
      ) : workers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <span className="text-5xl mb-3">👷</span>
          <p className="text-sm">No hay trabajadores registrados</p>
          <p className="text-xs mt-1">Agrega tu primer trabajador para comenzar</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active workers */}
          {activeWorkers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 bg-gray-900">
                <h2 className="text-lg font-bold text-yellow-400">Activos</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold text-gray-600">Nombre</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Cargo</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Total Haberes</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Descuentos</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Impuesto</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Sueldo Líquido</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600 w-24">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeWorkers.map((w) => (
                      <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 sm:px-6 py-3 text-gray-900 font-medium">{w.name}</td>
                        <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{w.position || '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{formatCLP(w.total_earnings)}</td>
                        <td className="px-4 py-3 text-right text-red-600 hidden md:table-cell">{formatCLP(w.total_deductions)}</td>
                        <td className="px-4 py-3 text-right text-orange-600 hidden md:table-cell">{formatCLP(w.tax_amount)}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">{formatCLP(w.net_salary)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleEdit(w)} className="p-1.5 text-gray-400 hover:text-yellow-600 transition-colors" title="Editar">
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(w)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Eliminar">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Inactive workers */}
          {inactiveWorkers.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden opacity-75">
              <div className="px-4 sm:px-6 py-4 bg-gray-700">
                <h2 className="text-lg font-bold text-gray-300">Inactivos</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 sm:px-6 py-3 font-semibold text-gray-600">Nombre</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden sm:table-cell">Cargo</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Total Haberes</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600 w-24">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {inactiveWorkers.map((w) => (
                      <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 sm:px-6 py-3 text-gray-500">{w.name}</td>
                        <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{w.position || '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{formatCLP(w.total_earnings)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleEdit(w)} className="p-1.5 text-gray-400 hover:text-yellow-600 transition-colors" title="Editar">
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(w)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Eliminar">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <WorkerFormModal
          worker={editingWorker}
          onClose={() => { setShowForm(false); setEditingWorker(null) }}
          onSuccess={(msg) => {
            setShowForm(false)
            setEditingWorker(null)
            showSuccess(msg)
            fetchWorkers()
          }}
        />
      )}
    </div>
  )
}
