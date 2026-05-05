import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { UserIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import CompanyProfileForm from '../components/CompanyProfileForm'
import { getCompanyProfile, saveCompanyProfile, patchCompanyProfile } from '../services/quotesApi'

export default function Profile() {
  const { user } = useAuth()

  const [companyProfile, setCompanyProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileApiErrors, setProfileApiErrors] = useState({})
  const [profileSuccess, setProfileSuccess] = useState('')

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await getCompanyProfile()
        setCompanyProfile(res.data)
      } catch (err) {
        // 404 significa que aún no existe — se creará al guardar
        if (err.response?.status !== 404) {
          console.error('Error cargando perfil de empresa:', err)
        }
      } finally {
        setLoadingProfile(false)
      }
    }
    fetchProfile()
  }, [])

  const handleSaveCompanyProfile = async (data, options = {}) => {
    setSavingProfile(true)
    setProfileApiErrors({})
    setProfileSuccess('')
    try {
      // Si es FormData (con logo), usar PATCH multipart para no requerir todos los campos required
      const isMultipart = data instanceof FormData
      const res = isMultipart
        ? await patchCompanyProfile(data)
        : await saveCompanyProfile(data)
      setCompanyProfile(res.data)
      setProfileSuccess('Perfil de empresa guardado correctamente')
      setTimeout(() => setProfileSuccess(''), 5000)
    } catch (err) {
      if (err.response?.data && typeof err.response.data === 'object') {
        setProfileApiErrors(err.response.data)
      } else {
        setProfileApiErrors({ detail: 'Error al guardar el perfil' })
      }
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-gray-500 mt-1">Información de tu cuenta y empresa</p>
      </div>

      {/* Datos de usuario */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
            <UserIcon className="w-8 h-8 text-primary-700" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{user?.username}</h2>
            <p className="text-gray-500">{user?.email}</p>
          </div>
        </div>

        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <span className="flex items-center gap-2">
                <EnvelopeIcon className="w-4 h-4" />
                Correo electrónico
              </span>
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de usuario
            </label>
            <input
              type="text"
              value={user?.username || ''}
              disabled
              className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          <p className="text-sm text-gray-500">
            Para modificar datos personales, contacta al administrador.
          </p>
        </form>
      </div>

      {/* Perfil de empresa */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">Perfil de Empresa</h2>
          <p className="text-sm text-gray-500 mt-1">
            Estos datos aparecerán en los PDFs de cotizaciones generados.
          </p>
        </div>

        {profileSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
            {profileSuccess}
          </div>
        )}

        {loadingProfile ? (
          <p className="text-gray-400 text-sm py-4">Cargando perfil de empresa...</p>
        ) : (
          <CompanyProfileForm
            initialData={companyProfile}
            onSubmit={handleSaveCompanyProfile}
            loading={savingProfile}
            apiErrors={profileApiErrors}
          />
        )}
      </div>
    </div>
  )
}
