import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function Header({ privateArea = false }) {
	const navigate = useNavigate()
	const { user, signOut } = useAuth()

	if (privateArea) {
		const userLabel = user?.name || user?.email || 'Cliente'

		function handleSignOut() {
			signOut()
			navigate('/login')
		}

		return (
			<header className="private-header">
				<Link className="private-brand" to="/"><span>R</span><strong>Repuestos</strong>Pro<small>Tu vehículo, en buenas manos</small></Link>
				<div className="private-header-actions">
					<Link className="profile-link" to="/cliente">{userLabel}<span className="profile-avatar">{userLabel.charAt(0).toUpperCase()}</span></Link>
					<button className="logout-button" type="button" onClick={handleSignOut}>Cerrar sesión <span>↗</span></button>
				</div>
			</header>
		)
	}

	return (
		<header className="site-header">
			<Link className="brand" to="/"><span>R</span>Repuestos<strong>Pro</strong></Link>
			<nav className="site-nav" aria-label="Navegación principal">
				<a href="#categorias">Categorías</a>
				<a href="#tiendas">Tiendas</a>
				<Link to="/login">Iniciar sesión</Link>
				<Link className="nav-register" to="/register">Registrarse <span>↗</span></Link>
			</nav>
		</header>
	)
}

export default Header
