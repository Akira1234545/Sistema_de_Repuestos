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

function Unauthorized() {
	return <main className="route-message"><h1>Área administrativa</h1><p>El Sprint 1 disponible en el proyecto no especifica pantallas ni procesos administrativos. El acceso administrativo no se concede desde el registro público.</p></main>
}

function RegisterRoute() {
  const [searchParams] = useSearchParams()
  return searchParams.get('role') ? <Register /> : <RegisterType />
}

function App() {
  return (
    <BrowserRouter>
      <AuthContext>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterRoute />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route element={<ProtectedRoute allowedRoles={['cliente']} />}>
            <Route path="/cliente" element={<ClienteLayout />}>
              <Route index element={<DashboardCliente />} />
              <Route path="vehiculos" element={<Vehiculos />} />
              <Route path="vehiculos/crear" element={<CrearVehiculo />} />
              <Route path="vehiculos/editar/:id" element={<EditarVehiculo />} />
              <Route path="solicitudes" element={<Solicitudes />} />
              <Route path="solicitudes/crear" element={<CrearSolicitud />} />
              <Route path="solicitudes/editar/:id" element={<EditarSolicitud />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['tienda']} />}>
            <Route path="/tienda" element={<TiendaLayout />}>
              <Route index element={<DashboardTienda />} />
              <Route path="perfil" element={<PerfilTienda />} />
              <Route path="editar" element={<EditarTienda />} />
              <Route path="solicitudes" element={<SolicitudesDisponibles />} />
              <Route path="solicitudes/:id" element={<DetalleSolicitud />} />
            </Route>
          </Route>
        </Routes>
      </AuthContext>
    </BrowserRouter>
  )
}

export default App
