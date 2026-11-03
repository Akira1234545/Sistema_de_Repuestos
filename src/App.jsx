import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Link, Outlet, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { announceRoute } from './lib/routeIdentity.js'
import { ADMIN_ROLES } from './lib/roles.js'
const ClienteLayout = lazy(() => import('./layouts/ClienteLayout.jsx'))
const TiendaLayout = lazy(() => import('./layouts/TiendaLayout.jsx'))
import AuthContext from './context/AuthContext.jsx'
import { useAuth } from './context/authState.js'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import SystemAvailability from './components/SystemAvailability.jsx'
const Home = lazy(() => import('./pages/Home.jsx'))
const Login = lazy(() => import('./pages/auth/Login.jsx'))
const Register = lazy(() => import('./pages/auth/Register.jsx'))
const RegisterType = lazy(() => import('./pages/auth/RegisterType.jsx'))
const DashboardCliente = lazy(() => import('./pages/cliente/DashboardCliente.jsx'))
const Vehiculos = lazy(() => import('./pages/cliente/Vehiculos.jsx'))
const CrearVehiculo = lazy(() => import('./pages/cliente/CrearVehiculo.jsx'))
const EditarVehiculo = lazy(() => import('./pages/cliente/EditarVehiculo.jsx'))
const Solicitudes = lazy(() => import('./pages/cliente/Solicitudes.jsx'))
const CrearSolicitud = lazy(() => import('./pages/cliente/CrearSolicitud.jsx'))
const EditarSolicitud = lazy(() => import('./pages/cliente/EditarSolicitud.jsx'))
const DashboardTienda = lazy(() => import('./pages/tienda/DashboardTienda.jsx'))
const MisPropuestas = lazy(() => import('./pages/tienda/MisPropuestas.jsx'))
const PerfilTienda = lazy(() => import('./pages/tienda/PerfilTienda.jsx'))
const EditarTienda = lazy(() => import('./pages/tienda/EditarTienda.jsx'))
const SolicitudesDisponibles = lazy(() => import('./pages/tienda/SolicitudesDisponibles.jsx'))
const DetalleSolicitud = lazy(() => import('./pages/tienda/DetalleSolicitud.jsx'))
const PropuestasSolicitud = lazy(() => import('./pages/cliente/PropuestasSolicitud.jsx'))
const Promociones = lazy(() => import('./pages/Promociones.jsx'))
const DetallePromocion = lazy(() => import('./pages/DetallePromocion.jsx'))
const Favoritos = lazy(() => import('./pages/Favoritos.jsx'))
const TiendaPromociones = lazy(() => import('./pages/tienda/TiendaPromociones.jsx'))
const ResenasRecibidas = lazy(() => import('./pages/tienda/ResenasRecibidas.jsx'))
const CategoriasTienda = lazy(() => import('./pages/tienda/CategoriasTienda.jsx'))
const GestionPromocion = lazy(() => import('./pages/tienda/GestionPromocion.jsx'))
const AdminAccess = lazy(() => import('./pages/AdminAccess.jsx'))
const TiendasPublicas = lazy(() => import('./pages/TiendasPublicas.jsx'))
const AccountRecovery = lazy(() => import('./pages/auth/AccountRecovery.jsx'))

function RouteIdentity() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
      return
    }
    window.scrollTo(0, 0)
    announceRoute()
  }, [pathname, hash])
  return <Outlet />
}

function RegisterRoute() {
  const [searchParams] = useSearchParams()
  return searchParams.get('role') ? <Register key={searchParams.get('role')} /> : <RegisterType />
}

function RoleLayout() {
  const { role } = useAuth()
  return role === 'tienda' ? <TiendaLayout /> : <ClienteLayout />
}

function App() {
  return (
    <BrowserRouter>
      <AuthContext>
        <SystemAvailability>
          <Suspense fallback={<p className="route-loading" role="status">Cargando página…</p>}>
          <Routes>
            <Route element={<RouteIdentity />}>
            <Route path="/" element={<Home />} />
            <Route path="/tiendas" element={<TiendasPublicas />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<AccountRecovery />} />
            <Route path="/resend-confirmation" element={<AccountRecovery confirmation />} />
            <Route path="/reset-password" element={<AccountRecovery reset />} />
            <Route path="/register" element={<RegisterRoute />} />
            <Route element={<ProtectedRoute allowedRoles={ADMIN_ROLES} />}>
              <Route path="/admin" element={<AdminAccess />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['cliente', 'tienda']} />}>
              <Route element={<RoleLayout />}>
                <Route path="/promociones" element={<Promociones />} />
                <Route path="/promociones/:id" element={<DetallePromocion />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['cliente']} />}>
              <Route path="/cliente" element={<ClienteLayout />}>
                <Route index element={<DashboardCliente />} />
                <Route path="vehiculos" element={<Vehiculos />} />
                <Route path="vehiculos/crear" element={<CrearVehiculo />} />
                <Route path="vehiculos/editar/:id" element={<EditarVehiculo />} />
                <Route path="solicitudes" element={<Solicitudes />} />
                <Route path="solicitudes/crear" element={<CrearSolicitud />} />
                <Route path="solicitudes/editar/:id" element={<EditarSolicitud />} />
                <Route path="solicitudes/:id/propuestas" element={<PropuestasSolicitud />} />
                <Route path="favoritos" element={<Favoritos />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['tienda']} />}>
              <Route path="/tienda" element={<TiendaLayout />}>
                <Route index element={<DashboardTienda />} />
                <Route path="perfil" element={<PerfilTienda />} />
                <Route path="editar" element={<EditarTienda />} />
                <Route path="categorias" element={<CategoriasTienda />} />
                <Route path="solicitudes" element={<SolicitudesDisponibles />} />
                <Route path="propuestas" element={<MisPropuestas />} />
                <Route path="solicitudes/:id" element={<DetalleSolicitud />} />
                <Route path="promociones" element={<TiendaPromociones />} />
                <Route path="resenas" element={<ResenasRecibidas />} />
                <Route path="promociones/crear" element={<GestionPromocion />} />
                <Route path="promociones/:id/editar" element={<GestionPromocion />} />
                <Route path="favoritos" element={<Favoritos />} />
              </Route>
            </Route>
            <Route path="*" element={<main className="route-message"><h1>Página no encontrada</h1><p>La dirección no existe o cambió.</p><Link className="button" to="/">Volver al inicio</Link></main>} />
            </Route>
          </Routes>
          </Suspense>
        </SystemAvailability>
      </AuthContext>
    </BrowserRouter>
  )
}

export default App
