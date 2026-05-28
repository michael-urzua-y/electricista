import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  UserIcon,
  Bars3Icon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'

export default function Layout() {
  const { user, logout, hasModule } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    // { to: '/',            emoji: '🏠', label: 'Dashboard',    color: 'text-blue-600',    bg: 'bg-blue-50'    },
    // { to: '/clients',     emoji: '👥', label: 'Clientes',     color: 'text-teal-600',    bg: 'bg-teal-50'    },
    // { to: '/comparacion', emoji: '📊', label: 'Comparación',  color: 'text-orange-600',  bg: 'bg-orange-50'  },
    // { to: '/accounting',  emoji: '📒', label: 'Contabilidad', color: 'text-indigo-600',  bg: 'bg-indigo-50'  },
    { to: '/', module: 'quotes', emoji: '📋', label: 'Cotizaciones', color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { to: '/facturas', module: 'invoices', emoji: '📄', label: 'Compras', color: 'text-violet-600', bg: 'bg-violet-50' },
    { to: '/gastos-generales', module: 'expenses', emoji: '🧾', label: 'Gastos Generales', color: 'text-red-600', bg: 'bg-red-50' },
    { to: '/precios', module: 'prices', emoji: '💰', label: 'Precios', color: 'text-amber-600', bg: 'bg-amber-50' },
    // { to: '/productos',   emoji: '📦', label: 'Productos',    color: 'text-emerald-600', bg: 'bg-emerald-50', badge: <LowStockBadge /> },
    // { to: '/proveedores', emoji: '🏪', label: 'Proveedores',  color: 'text-pink-600',    bg: 'bg-pink-50'    },
    { to: '/trabajadores', module: 'workers', emoji: '👷', label: 'Trabajadores', color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { to: '/estimador-tributario', module: 'tax_estimator', emoji: '🧮', label: 'Estimador Tributario', color: 'text-purple-600', bg: 'bg-purple-50' },
  ].filter((item) => hasModule(item.module))

  const SidebarContent = () => (
    <>
      <nav className="p-4 space-y-1 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-yellow-500 text-gray-900 font-bold'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              } ${sidebarCollapsed ? 'justify-center' : ''}`
            }
            title={sidebarCollapsed ? item.label : ''}
          >
            {({ isActive }) => (
              <>
                <span className="text-xl flex-shrink-0">{item.emoji}</span>
                {!sidebarCollapsed && item.label}
                {!sidebarCollapsed && item.badge}
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
      <aside className={`hidden lg:flex lg:flex-col bg-gray-900 border-r border-gray-700 fixed h-full z-10 transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}>
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
           {!sidebarCollapsed && (
             <div className="flex items-center gap-2">
               <img src="/monay-solutions-logo-horizontal.png" alt="Logo" className="h-10 w-auto" />
             </div>
           )}
           {sidebarCollapsed && (
             <img src="/monay-solutions-logo.png" alt="Logo" className="w-8 h-8 mx-auto" />
           )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex items-center justify-center p-2 text-gray-400 hover:text-yellow-400 hover:bg-gray-800 rounded-lg transition-colors ml-auto"
            title={sidebarCollapsed ? 'Expandir' : 'Contraer'}
          >
            <Bars3Icon className="w-5 h-5" />
          </button>
        </div>
        <SidebarContent />
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
        className={`fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-700 z-30 flex flex-col transform transition-transform duration-300 lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
         <div className="p-6 border-b border-gray-700 flex items-center gap-3">
           <img src="/monay-solutions-logo-horizontal.png" alt="Logo" className="h-10 w-auto" />
         </div>
        <SidebarContent />
      </aside>

      {/* ── Main content ── */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
      }`}>

        {/* Desktop top bar */}
        <header className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          {/* Mobile hamburguesa */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Abrir menú"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <span className="text-base font-bold text-white flex items-center gap-2">
              <img src="/monay-solutions-logo-horizontal.png" alt="Logo" className="h-7 w-auto" />
            </span>
          </div>

          {/* User info and logout */}
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => navigate('/perfil')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              title="Mi Perfil"
            >
              <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-4 h-4 text-gray-900" />
              </div>
             <div className="hidden sm:block text-left">
               <p className="text-sm font-semibold text-white">
                  {user?.username || 'Usuario'}
                </p>
             </div>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 border border-gray-700 hover:border-yellow-500 rounded-lg transition-all whitespace-nowrap"
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
