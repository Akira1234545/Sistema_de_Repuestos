import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/authState.js'
import AdminMfaGate from './AdminMfaGate.jsx'

function ProtectedRoute({ allowedRoles }) {
	const location = useLocation()
	const { user, role, loading, profileError, retryProfile, signOut } = useAuth()

  if (loading) {
    return <p>Comprobando sesión...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  if (!allowedRoles.includes(role)) {
		return <main className="route-message"><h1>Acceso no disponible</h1><p role="alert">{profileError || 'Tu cuenta no tiene permiso para abrir esta sección.'}</p>{profileError && <button className="button" type="button" onClick={retryProfile}>Reintentar validación</button>}<button className="button button-secondary" type="button" onClick={() => { void signOut() }}>Cerrar sesión</button></main>
  }

  if (['administrador', 'superAdministrador'].includes(role)) return <AdminMfaGate key={user.id}><Outlet /></AdminMfaGate>
  return <Outlet />
}

export default ProtectedRoute
