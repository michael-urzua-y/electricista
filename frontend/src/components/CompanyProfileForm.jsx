import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { formatRut, validateRut } from '../utils/rutUtils'
import { MAX_COMPANY_LOGO_MB } from '../config/appConfig'

export default function CompanyProfileForm({
  initialData,
  onSubmit,
  loading,
  apiErrors,
  readOnly = false,
  onEdit,
  onCancelEdit,
}) {
  const [name, setName] = useState(initialData?.name || '')
  const [rut, setRut] = useState(initialData?.rut || '')
  const [rutError, setRutError] = useState('')
  const [address, setAddress] = useState(initialData?.address || '')
  const [phone, setPhone] = useState(initialData?.phone || '')
  const [email, setEmail] = useState(initialData?.email || '')
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoError, setLogoError] = useState('')
  const [hasExistingLogo, setHasExistingLogo] = useState(!!initialData?.has_logo)

  const resetFromInitialData = useCallback(() => {
    if (!initialData) return
    setName(initialData.name || '')
    setRut(initialData.rut ? formatRut(initialData.rut) : '')
    setAddress(initialData.address || '')
    setPhone(initialData.phone || '')
    setEmail(initialData.email || '')
    setRutError('')
    setLogoFile(null)
    setLogoError('')
    setHasExistingLogo(!!initialData.has_logo)
  }, [initialData])

  useEffect(() => {
    resetFromInitialData()
  }, [resetFromInitialData, readOnly])

  // Cargar el logo desde el endpoint cuando existe
  useEffect(() => {
    if (initialData?.has_logo) {
      // Usar el endpoint autenticado vía axios como blob
      api.get('/empresa/perfil/logo/', { responseType: 'blob' })
        .then(res => {
          const url = URL.createObjectURL(res.data)
          setLogoPreview(url)
        })
        .catch(() => {})
    } else if (initialData?.logo_base64) {
      // Compatibilidad: perfil viejo con base64
      setLogoPreview(`data:image/png;base64,${initialData.logo_base64}`)
      setHasExistingLogo(true)
    } else {
      setLogoPreview(null)
    }
  }, [initialData])

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setLogoError('El logo debe ser PNG o JPEG')
      e.target.value = ''
      return
    }
    if (file.size > MAX_COMPANY_LOGO_MB * 1024 * 1024) {
      setLogoError(`El logo no debe superar ${MAX_COMPANY_LOGO_MB} MB`)
      e.target.value = ''
      return
    }

    setLogoError('')
    setLogoFile(file)
    // Preview local del archivo seleccionado
    const reader = new FileReader()
    reader.onload = (ev) => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = async () => {
    if (readOnly) return
    if (!confirm('¿Eliminar el logo actual?')) return
    try {
      await api.delete('/empresa/perfil/logo/')
      setLogoPreview(null)
      setLogoFile(null)
      setHasExistingLogo(false)
    } catch (err) {
      setLogoError('No se pudo eliminar el logo')
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (readOnly) return
    if (logoError) return
    const formattedRut = formatRut(rut)
    if (!validateRut(formattedRut)) {
      setRutError('RUT inválido')
      return
    }
    setRut(formattedRut)

    // Si hay un archivo nuevo, usar FormData (multipart)
    if (logoFile) {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('rut', formattedRut)
      formData.append('address', address)
      formData.append('phone', phone)
      formData.append('email', email)
      formData.append('logo_upload', logoFile)
      onSubmit(formData, { isMultipart: true })
    } else {
      // Solo datos de texto (sin cambiar logo)
      onSubmit({ name, rut: formattedRut, address, phone, email })
    }
  }

  const fieldClass = (hasError) =>
    `w-full px-3 py-2 border rounded-lg text-sm outline-none ${
      readOnly
        ? 'bg-gray-50 border-gray-200 text-gray-600 cursor-not-allowed'
        : `bg-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-400 ${
            hasError ? 'border-red-400' : 'border-gray-300'
          }`
    }`

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
            Nombre empresa <span className="text-red-400">*</span>
          </label>
          <input value={name} onChange={e => setName(e.target.value)} required disabled={readOnly}
            className={fieldClass(!!apiErrors?.name)} placeholder="Monay Solutions SpA" />
          {apiErrors?.name && <p className="text-red-500 text-xs mt-1">{apiErrors.name}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
            RUT <span className="text-red-400">*</span>
          </label>
          <input value={rut} onChange={e => {
            const formatted = formatRut(e.target.value)
            setRut(formatted)
            if (formatted.length > 3 && !validateRut(formatted)) {
              setRutError('RUT inválido')
            } else {
              setRutError('')
            }
          }}
            onBlur={() => { if (rut && !validateRut(rut)) setRutError('RUT inválido') }}
            maxLength={12}
            required
            disabled={readOnly}
            className={fieldClass(!!apiErrors?.rut || !!rutError)} placeholder="76.543.210-9" />
          {(rutError || apiErrors?.rut) && <p className="text-red-500 text-xs mt-1">{rutError || apiErrors.rut}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
            Email empresa <span className="text-red-400">*</span>
          </label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={readOnly}
            className={fieldClass(!!apiErrors?.email)} placeholder="contacto@empresa.cl" />
          {apiErrors?.email && <p className="text-red-500 text-xs mt-1">{apiErrors.email}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Teléfono</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} disabled={readOnly}
            className={fieldClass(!!apiErrors?.phone)} placeholder="+56 9 1234 5678" />
          {apiErrors?.phone && <p className="text-red-500 text-xs mt-1">{apiErrors.phone}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Dirección</label>
          <input value={address} onChange={e => setAddress(e.target.value)} disabled={readOnly}
            className={fieldClass(!!apiErrors?.address)} placeholder="Av. Ejemplo 1234, Santiago" />
          {apiErrors?.address && <p className="text-red-500 text-xs mt-1">{apiErrors.address}</p>}
        </div>
      </div>

      {/* Logo */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
          Logo (PNG o JPEG, máx. {MAX_COMPANY_LOGO_MB} MB)
        </label>
        <div className="flex items-center gap-4 flex-wrap">
          {logoPreview && (
            <img src={logoPreview} alt="Logo empresa"
              className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-white p-1" />
          )}
          {readOnly && !logoPreview && (
            <span className="text-sm text-gray-500">Sin logo cargado</span>
          )}
          {!readOnly && (
            <>
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <span>{hasExistingLogo ? 'Cambiar logo' : 'Seleccionar archivo'}</span>
                <input type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} className="sr-only" />
              </label>
              {hasExistingLogo && (
                <button type="button" onClick={handleRemoveLogo}
                  className="text-sm text-red-600 hover:text-red-800 transition-colors">
                  Eliminar logo
                </button>
              )}
            </>
          )}
          {logoFile && (
            <span className="text-xs text-green-600">
              Nuevo: {logoFile.name} ({(logoFile.size / 1024).toFixed(0)} KB)
            </span>
          )}
        </div>
        {logoError && <p className="text-red-500 text-xs mt-1">{logoError}</p>}
        {apiErrors?.logo_upload && <p className="text-red-500 text-xs mt-1">{apiErrors.logo_upload}</p>}
      </div>

      {apiErrors?.detail && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {apiErrors.detail}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        {readOnly ? (
          <button type="button" onClick={onEdit}
            className="px-5 py-2.5 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors">
            Actualizar perfil
          </button>
        ) : (
          <>
            {initialData && onCancelEdit && (
              <button type="button" onClick={onCancelEdit} disabled={loading}
                className="px-4 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                Cancelar
              </button>
            )}
            <button type="submit" disabled={loading || !!logoError}
              className="px-5 py-2.5 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar Perfil'}
            </button>
          </>
        )}
      </div>
    </form>
  )
}
