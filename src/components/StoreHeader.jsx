import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authState.js'

function StoreHeader() {
	const navigate = useNavigate()
	const { user, signOut } = useAuth()
	const userLabel = user?.email || 'Tienda'

	async function handleSignOut() {
		await signOut()
		navigate('/login')
	}

	return (
		<header className="store-header">
			<div className="store-search" role="search">
				<span>⌕</span>
				<input type="search" placeholder="Buscar repuestos, marcas, modelos..." aria-label="Buscar repuestos, marcas y modelos" />
			</div>
			<div className="store-header-actions">
				<button className="store-notifications" type="button" aria-label="Notificaciones">♢<i /></button>
				<Link className="store-profile-link" to="/tienda/perfil">
					<span className="store-profile-label">Mi tienda</span>
					<span className="store-avatar">{userLabel.charAt(0).toUpperCase()}</span>
				</Link>
				<button className="store-logout" type="button" onClick={handleSignOut}>
					Cerrar sesión <span>↗</span>
				</button>
			</div>
		</header>
	)
}

export default StoreHeader
