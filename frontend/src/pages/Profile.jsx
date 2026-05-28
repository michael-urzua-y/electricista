import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import {
  UserIcon,
  EnvelopeIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import CompanyProfileForm from '../components/CompanyProfileForm'
import SMTPConfigForm from '../components/SMTPConfigForm'
import { getCompanyProfile, saveCompanyProfile, patchCompanyProfile } from '../services/quotesApi'

export default function Profile() {
  const { user } = useAuth()

  const [companyProfile, setCompanyProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileApiErrors, setProfileApiErrors] = useState({})
  const [profileSuccess, setProfileSuccess] = useState('')
  const [smtpSuccess, setSmtpSuccess] = useState('')
  const [profileEditing, setProfileEditing] = useState(false)
  const [activeConfigSection, setActiveConfigSection] = useState('company')

  const [hasSMTPConfig, setHasSMTPConfig] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await getCompanyProfile()
        setCompanyProfile(res.data)
        setProfileEditing(false)
      } catch (err) {
        if (err.response?.status === 404) {
          setProfileEditing(true)
        } else {
          console.error('Error cargando perfil de empresa:', err)
        }
      } finally {
        setLoadingProfile(false)
      }
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    const fetchSMTP = async () => {
      try {
        await api.get('/empresa/smtp/')
        setHasSMTPConfig(true)
      } catch {
        setHasSMTPConfig(false)
      }
    }
    fetchSMTP()
  }, [])

  const handleSaveCompanyProfile = async (data) => {
    setSavingProfile(true)
    setProfileApiErrors({})
    setProfileSuccess('')
    try {
      const isMultipart = data instanceof FormData
      const res = isMultipart
        ? await patchCompanyProfile(data)
        : await saveCompanyProfile(data)
      setCompanyProfile(res.data)
      setProfileEditing(false)
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

  const handleSMTPSaved = () => {
    setHasSMTPConfig(true)
    setSmtpSuccess('Configuración de correo guardada correctamente')
    setTimeout(() => setSmtpSuccess(''), 5000)
  }

  const handleEditCompanyProfile = () => {
    setProfileApiErrors({})
    setProfileSuccess('')
    setProfileEditing(true)
  }

  const handleCancelCompanyProfile = () => {
    setProfileApiErrors({})
    setProfileSuccess('')
    setProfileEditing(false)
  }

  const hasCompanyProfile = Boolean(companyProfile?.id)
  const profileLocked = hasCompanyProfile && !profileEditing

  const statusBadgeClass = (isReady) =>
    `inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
      isReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
    }`

  const navButtonClass = (section) =>
    `w-full text-left p-3 rounded-lg border transition-colors ${
      activeConfigSection === section
        ? 'bg-white border-yellow-300 shadow-sm'
        : 'bg-transparent border-transparent hover:bg-white hover:border-gray-200'
    }`

  return (
    <div className="max-w-5xl space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-gray-500 mt-1">Información de tu cuenta y empresa</p>
      </div>

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

        <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <p className="text-sm text-gray-500 md:col-span-2">
            Para modificar datos personales, contacta al administrador.
          </p>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Configuración para cotizaciones</h2>
          <p className="text-sm text-gray-500 mt-1">
            Administra los datos comerciales y el correo de salida desde un mismo panel.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
          <nav className="bg-gray-50/80 p-4 border-b border-gray-100 lg:border-b-0 lg:border-r">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setActiveConfigSection('company')}
                className={navButtonClass('company')}
              >
                <span className="flex items-start gap-3">
                  <BuildingOffice2Icon className="w-5 h-5 text-yellow-700 mt-0.5" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-gray-900">Perfil de Empresa</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Datos para PDFs</span>
                  </span>
                </span>
                <span className={`${statusBadgeClass(hasCompanyProfile)} mt-3`}>
                  {hasCompanyProfile ? 'Guardado' : 'Pendiente'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveConfigSection('smtp')}
                className={navButtonClass('smtp')}
              >
                <span className="flex items-start gap-3">
                  <EnvelopeIcon className="w-5 h-5 text-primary-700 mt-0.5" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-gray-900">Correo de cotizaciones</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Envío SMTP</span>
                  </span>
                </span>
                <span className={`${statusBadgeClass(hasSMTPConfig)} mt-3`}>
                  {hasSMTPConfig ? 'Configurado' : 'Pendiente'}
                </span>
              </button>
            </div>
          </nav>

          <div className="p-6">
            {activeConfigSection === 'company' ? (
              <section>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                      <BuildingOffice2Icon className="w-5 h-5 text-yellow-700" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Perfil de Empresa</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Nombre, RUT, contacto, dirección y logo de la empresa.
                      </p>
                    </div>
                  </div>
                  <span className={statusBadgeClass(hasCompanyProfile)}>
                    {hasCompanyProfile ? 'Guardado' : 'Pendiente'}
                  </span>
                </div>

                {profileSuccess && (
                  <div className="mb-5 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5" />
                    <span>{profileSuccess}</span>
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
                    readOnly={profileLocked}
                    onEdit={handleEditCompanyProfile}
                    onCancelEdit={handleCancelCompanyProfile}
                  />
                )}
              </section>
            ) : (
              <section>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                      <EnvelopeIcon className="w-5 h-5 text-primary-700" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Correo para envío de cotizaciones</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Cuenta SMTP desde donde el sistema enviará las cotizaciones a tus clientes.
                      </p>
                    </div>
                  </div>
                  <span className={statusBadgeClass(hasSMTPConfig)}>
                    {hasSMTPConfig ? 'Configurado' : 'Pendiente'}
                  </span>
                </div>

                {smtpSuccess && (
                  <div className="mb-5 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5" />
                    <span>{smtpSuccess}</span>
                  </div>
                )}

                <SMTPConfigForm onSaved={handleSMTPSaved} />
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
