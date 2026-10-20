import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/authState.js'

function ProtectedRoute({ allowedRoles }) {
	const { user, role, loading, profileError } = useAuth()

  if (loading) {
    return <p>Comprobando sesión...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(role)) {
		return <main className="route-message"><h1>Acceso no disponible</h1><p role="alert">{profileError || 'Tu cuenta no tiene permiso para abrir esta sección.'}</p></main>
  }

  return <Outlet />
}

export default ProtectedRoute
