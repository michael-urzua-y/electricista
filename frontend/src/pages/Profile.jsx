import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { UserIcon, EnvelopeIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
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

  const [smtpExpanded, setSmtpExpanded] = useState(false)
  const [hasSMTPConfig, setHasSMTPConfig] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await getCompanyProfile()
        setCompanyProfile(res.data)
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error('Error cargando perfil de empresa:', err)
        }
      } finally {
        setLoadingProfile(false)
      }
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    // Verificar si ya existe configuración SMTP para decidir el estado inicial del acordeón
    const fetchSMTP = async () => {
      try {
        await api.get('/empresa/smtp/')
        setHasSMTPConfig(true)
        setSmtpExpanded(true)
      } catch {
        setHasSMTPConfig(false)
      }
    }
    fetchSMTP()
  }, [])

  const handleSaveCompanyProfile = async (data, options = {}) => {
    setSavingProfile(true)
    setProfileApiErrors({})
    setProfileSuccess('')
    try {
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

  const handleSMTPSaved = () => {
    setHasSMTPConfig(true)
    setSmtpExpanded(false)
    setProfileSuccess('Configuración de correo guardada correctamente')
    setTimeout(() => setProfileSuccess(''), 5000)
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

      {/* Configuración de correo SMTP */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          type="button"
          onClick={() => setSmtpExpanded(!smtpExpanded)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="text-left">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <EnvelopeIcon className="w-5 h-5 text-primary-700" />
              Correo para envío de cotizaciones
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Configura tu correo para enviar cotizaciones a tus clientes
              {hasSMTPConfig && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Configurado
                </span>
              )}
            </p>
          </div>
          {smtpExpanded ? (
            <ChevronUpIcon className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {smtpExpanded && (
          <div className="px-6 pb-6 border-t border-gray-100">
            <SMTPConfigForm onSaved={handleSMTPSaved} />
          </div>
        )}
      </div>
    </div>
  )
}
