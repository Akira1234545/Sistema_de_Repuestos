import { BrowserRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import './App.css'
import ClienteLayout from './layouts/ClienteLayout.jsx'
import TiendaLayout from './layouts/TiendaLayout.jsx'
import AuthContext from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Home from './pages/Home.jsx'
import Login from './pages/auth/Login.jsx'
import Register from './pages/auth/Register.jsx'
import RegisterType from './pages/auth/RegisterType.jsx'
import DashboardCliente from './pages/cliente/DashboardCliente.jsx'
import Vehiculos from './pages/cliente/Vehiculos.jsx'
import CrearVehiculo from './pages/cliente/CrearVehiculo.jsx'
import EditarVehiculo from './pages/cliente/EditarVehiculo.jsx'
import Solicitudes from './pages/cliente/Solicitudes.jsx'
import CrearSolicitud from './pages/cliente/CrearSolicitud.jsx'
import EditarSolicitud from './pages/cliente/EditarSolicitud.jsx'
import DashboardTienda from './pages/tienda/DashboardTienda.jsx'
import PerfilTienda from './pages/tienda/PerfilTienda.jsx'
import EditarTienda from './pages/tienda/EditarTienda.jsx'
import SolicitudesDisponibles from './pages/tienda/SolicitudesDisponibles.jsx'
import DetalleSolicitud from './pages/tienda/DetalleSolicitud.jsx'
import PropuestasSolicitud from './pages/cliente/PropuestasSolicitud.jsx'
import Promociones from './pages/Promociones.jsx'
import DetallePromocion from './pages/DetallePromocion.jsx'
import Favoritos from './pages/Favoritos.jsx'
import TiendaPromociones from './pages/tienda/TiendaPromociones.jsx'
import CategoriasTienda from './pages/tienda/CategoriasTienda.jsx'
import GestionPromocion from './pages/tienda/GestionPromocion.jsx'
import AdminAccess from './pages/AdminAccess.jsx'
import TiendasPublicas from './pages/TiendasPublicas.jsx'
import FormDraftPersistence from './components/FormDraftPersistence.jsx'

function RegisterRoute() {
  const [searchParams] = useSearchParams()
  return searchParams.get('role') ? <Register /> : <RegisterType />
}

function App() {
  return (
    <BrowserRouter>
      <AuthContext>
        <FormDraftPersistence />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tiendas" element={<TiendasPublicas />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterRoute />} />
          <Route element={<ProtectedRoute allowedRoles={['administrador', 'superAdministrador']} />}>
            <Route path="/admin" element={<AdminAccess />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['cliente', 'tienda']} />}>
            <Route path="/promociones" element={<Promociones />} />
            <Route path="/promociones/:id" element={<DetallePromocion />} />
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
              <Route path="solicitudes/:id" element={<DetalleSolicitud />} />
              <Route path="promociones" element={<TiendaPromociones />} />
              <Route path="promociones/crear" element={<GestionPromocion />} />
              <Route path="promociones/:id/editar" element={<GestionPromocion />} />
              <Route path="favoritos" element={<Favoritos />} />
            </Route>
          </Route>
        </Routes>
      </AuthContext>
    </BrowserRouter>
  )
}

export default App
