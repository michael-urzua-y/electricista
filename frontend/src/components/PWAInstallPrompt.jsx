import { useState, useEffect } from 'react'
import { DevicePhoneMobileIcon, XMarkIcon } from '@heroicons/react/24/outline'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Detectar iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    setIsIOS(ios)

    // Si ya está instalada como PWA, no mostrar
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // Verificar si el usuario ya descartó el prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) {
      const dismissedDate = new Date(dismissed)
      const daysSince = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince < 7) return // No mostrar por 7 días
    }

    // Android/Chrome: capturar evento beforeinstallprompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS: mostrar instrucciones después de 3 visitas
    if (ios) {
      const visits = parseInt(localStorage.getItem('pwa-visits') || '0') + 1
      localStorage.setItem('pwa-visits', visits.toString())
      if (visits >= 3) setShowPrompt(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 animate-fade-in">
      <div className="bg-gray-900 text-white rounded-xl shadow-2xl p-4 border border-gray-700">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-yellow-500 rounded-lg flex-shrink-0">
            <DevicePhoneMobileIcon className="w-5 h-5 text-gray-900" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Instalar Monayelectric</p>
            {isIOS ? (
              <p className="text-xs text-gray-300 mt-1">
                Toca <span className="inline-block">⬆️</span> Compartir y luego "Agregar a pantalla de inicio"
              </p>
            ) : (
              <p className="text-xs text-gray-300 mt-1">
                Accede más rápido desde tu pantalla de inicio
              </p>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-white flex-shrink-0"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstall}
            className="mt-3 w-full py-2 px-4 bg-yellow-500 hover:bg-yellow-600 text-gray-900 text-sm font-bold rounded-lg transition-colors"
          >
            Instalar App
          </button>
        )}
      </div>
    </div>
  )
}
