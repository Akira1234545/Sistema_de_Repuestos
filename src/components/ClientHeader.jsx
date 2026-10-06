import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function ClientHeader() {
	const navigate = useNavigate()
	const { user, signOut } = useAuth()
	const userLabel = user?.user_metadata?.nombre || user?.email || 'Cliente'

	async function handleSignOut() {
		await signOut()
		navigate('/login')
	}

	return (
		<header className="client-header">
			<div className="client-search" role="search">
				<span>⌕</span>
				<input type="search" placeholder="Buscar repuestos, marcas, modelos..." aria-label="Buscar repuestos, marcas y modelos" />
			</div>
			<div className="client-header-actions">
				<button className="client-notifications" type="button" aria-label="Notificaciones">♢<i /></button>
				<Link className="client-profile-link" to="/cliente">
					<span className="client-profile-label">{userLabel}</span>
					<span className="client-avatar">{userLabel.charAt(0).toUpperCase()}</span>
				</Link>
				<button className="client-logout" type="button" onClick={handleSignOut}>Cerrar sesión <span>↗</span></button>
			</div>
		</header>
	)
}

export default ClientHeader
