import { useState } from 'react'

export default function CompanyProfileForm({ initialData, onSubmit, loading, apiErrors }) {
  const [name, setName] = useState(initialData?.name || '')
  const [rut, setRut] = useState(initialData?.rut || '')
  const [address, setAddress] = useState(initialData?.address || '')
  const [phone, setPhone] = useState(initialData?.phone || '')
  const [email, setEmail] = useState(initialData?.email || '')
  const [logoBase64, setLogoBase64] = useState(initialData?.logo_base64 || '')
  const [logoPreview, setLogoPreview] = useState(
    initialData?.logo_base64 ? `data:image/png;base64,${initialData.logo_base64}` : null
  )
  const [logoError, setLogoError] = useState('')

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setLogoError('El logo debe ser PNG o JPEG')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('El logo no debe superar 2 MB')
      return
    }

    setLogoError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      // dataUrl = "data:image/png;base64,XXXX..."
      const base64 = dataUrl.split(',')[1]
      setLogoBase64(base64)
      setLogoPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (logoError) return
    onSubmit({ name, rut, address, phone, email, logo_base64: logoBase64 })
  }

  const fieldClass = (hasError) =>
    `w-full px-3 py-2 bg-white border rounded-lg text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-400 outline-none ${
      hasError ? 'border-red-400' : 'border-gray-300'
    }`

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nombre */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
            Nombre empresa <span className="text-red-400">*</span>
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className={fieldClass(!!apiErrors?.name)}
            placeholder="Monayelectric SpA"
          />
          {apiErrors?.name && <p className="text-red-500 text-xs mt-1">{apiErrors.name}</p>}
        </div>

        {/* RUT */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
            RUT <span className="text-red-400">*</span>
          </label>
          <input
            value={rut}
            onChange={e => setRut(e.target.value)}
            required
            className={fieldClass(!!apiErrors?.rut)}
            placeholder="76543210-9"
          />
          {apiErrors?.rut && <p className="text-red-500 text-xs mt-1">{apiErrors.rut}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
            Email empresa <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className={fieldClass(!!apiErrors?.email)}
            placeholder="contacto@empresa.cl"
          />
          {apiErrors?.email && <p className="text-red-500 text-xs mt-1">{apiErrors.email}</p>}
        </div>

        {/* Teléfono */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Teléfono</label>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className={fieldClass(!!apiErrors?.phone)}
            placeholder="+56 9 1234 5678"
          />
          {apiErrors?.phone && <p className="text-red-500 text-xs mt-1">{apiErrors.phone}</p>}
        </div>

        {/* Dirección */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Dirección</label>
          <input
            value={address}
            onChange={e => setAddress(e.target.value)}
            className={fieldClass(!!apiErrors?.address)}
            placeholder="Av. Ejemplo 1234, Santiago"
          />
          {apiErrors?.address && <p className="text-red-500 text-xs mt-1">{apiErrors.address}</p>}
        </div>
      </div>

      {/* Logo */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
          Logo (PNG o JPEG, máx. 2 MB)
        </label>
        <div className="flex items-center gap-4">
          {logoPreview && (
            <img
              src={logoPreview}
              alt="Logo empresa"
              className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-white p-1"
            />
          )}
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <span>Seleccionar archivo</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleLogoChange}
              className="sr-only"
            />
          </label>
          {logoBase64 && !logoPreview && (
            <span className="text-xs text-gray-500">Logo guardado</span>
          )}
        </div>
        {logoError && <p className="text-red-500 text-xs mt-1">{logoError}</p>}
        {apiErrors?.logo_base64 && <p className="text-red-500 text-xs mt-1">{apiErrors.logo_base64}</p>}
      </div>

      {/* Error general de la API */}
      {apiErrors?.detail && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {apiErrors.detail}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={loading || !!logoError}
          className="px-5 py-2.5 text-sm font-bold text-gray-900 bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar Perfil'}
        </button>
      </div>
    </form>
  )
}
