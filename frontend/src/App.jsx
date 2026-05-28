import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './layouts/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Invoices from './pages/Invoices'
import Products from './pages/Products'
import PriceComparison from './pages/PriceComparison'
import Profile from './pages/Profile'
import Providers from './pages/Providers'
import Quotes from './pages/Quotes'
import QuoteDetail from './pages/QuoteDetail'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Accounting from './pages/Accounting'
import Prices from './pages/Prices'
import GastosGenerales from './pages/GastosGenerales'
import Trabajadores from './pages/Trabajadores'
import EstimadorTributario from './pages/EstimadorTributario'
import PWAInstallPrompt from './components/PWAInstallPrompt'

function PrivateRoute({ children }) {
  const { token, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen">Cargando...</div>
  return token ? children : <Navigate to="/login" />
}

function ModuleRoute({ module, children }) {
  const { user, hasModule, defaultPath } = useAuth()
  if (!user) return null
  return hasModule(module) ? children : <Navigate to={defaultPath} replace />
}

function DefaultRoute() {
  const { hasModule, defaultPath } = useAuth()
  if (hasModule('quotes')) return <Quotes />
  return <Navigate to={defaultPath} replace />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route index element={<DefaultRoute />} />
            <Route path="facturas" element={<ModuleRoute module="invoices"><Invoices /></ModuleRoute>} />
            <Route path="productos" element={<ModuleRoute module="products"><Products /></ModuleRoute>} />
            <Route path="proveedores" element={<ModuleRoute module="products"><Providers /></ModuleRoute>} />
            <Route path="comparacion" element={<ModuleRoute module="products"><PriceComparison /></ModuleRoute>} />
            <Route path="perfil" element={<Profile />} />
            <Route path="cotizaciones" element={<ModuleRoute module="quotes"><Quotes /></ModuleRoute>} />
            <Route path="cotizaciones/:id" element={<ModuleRoute module="quotes"><QuoteDetail /></ModuleRoute>} />
            <Route path="clients" element={<ModuleRoute module="clients"><Clients /></ModuleRoute>} />
            <Route path="clients/:id" element={<ModuleRoute module="clients"><ClientDetail /></ModuleRoute>} />
            <Route path="accounting" element={<ModuleRoute module="accounting"><Accounting /></ModuleRoute>} />
            <Route path="precios" element={<ModuleRoute module="prices"><Prices /></ModuleRoute>} />
            <Route path="gastos-generales" element={<ModuleRoute module="expenses"><GastosGenerales /></ModuleRoute>} />
            <Route path="trabajadores" element={<ModuleRoute module="workers"><Trabajadores /></ModuleRoute>} />
            <Route path="estimador-tributario" element={<ModuleRoute module="tax_estimator"><EstimadorTributario /></ModuleRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <PWAInstallPrompt />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
