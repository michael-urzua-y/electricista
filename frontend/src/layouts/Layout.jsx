import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  UserIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { to: '/',            emoji: '🏠', label: 'Dashboard',   color: 'text-blue-600',    bg: 'bg-blue-50'    },
    { to: '/facturas',    emoji: '📄', label: 'Facturas',    color: 'text-violet-600',  bg: 'bg-violet-50'  },
    { to: '/productos',   emoji: '📦', label: 'Productos',   color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { to: '/comparacion', emoji: '📊', label: 'Comparación', color: 'text-orange-600',  bg: 'bg-orange-50'  },
    { to: '/proveedores', emoji: '🏪', label: 'Proveedores', color: 'text-pink-600',    bg: 'bg-pink-50'    },
  ]

  const SidebarContent = () => (
    <>
      <div className={`p-6 border-b border-gray-100 ${sidebarCollapsed ? 'flex items-center justify-center' : ''}`}>
        {sidebarCollapsed ? (
          <span className="text-2xl">⚡</span>
        ) : (
          <>
            <h1 className="text-xl font-bold text-primary-900 flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              Electricista Pro
            </h1>
            <p className="text-xs text-gray-500 mt-1">Gestión de materiales</p>
          </>
        )}
      </div>

      <nav className="p-4 space-y-1 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? `${item.bg} ${item.color}`
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${sidebarCollapsed ? 'justify-center' : ''}`
            }
            title={sidebarCollapsed ? item.label : ''}
          >
            {({ isActive }) => (
              <>
                <span className="text-xl flex-shrink-0">{item.emoji}</span>
                {!sidebarCollapsed && item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── Desktop Sidebar ── */}
      <aside className={`hidden lg:flex lg:flex-col bg-white border-r border-gray-200 fixed h-full z-10 transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}>
        <SidebarContent />
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title={sidebarCollapsed ? 'Expandir' : 'Contraer'}
          >
            <Bars3Icon className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile Sidebar ── */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-30 flex flex-col transform transition-transform duration-300 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-end p-3 border-b border-gray-100">
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* ── Main content ── */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      }`}>

        {/* Desktop top bar */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          {/* Mobile hamburguesa */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Abrir menú"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <span className="text-lg font-bold text-primary-900 flex items-center gap-1">
              <span>⚡</span> Electricista Pro
            </span>
          </div>

          {/* User info and logout - Always visible */}
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-5 h-5 text-primary-700" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-900">
                  {user?.username || 'Usuario'}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.email || ''}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap"
              title="Cerrar sesión"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
