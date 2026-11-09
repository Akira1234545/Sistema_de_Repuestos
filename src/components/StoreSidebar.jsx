import Icon from './Icon.jsx'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useRef } from 'react'
import { useAuth } from '../context/authState.js'
import { useBottomBar } from '../hooks/useBottomBar.js'
import BrandLogo from './BrandLogo.jsx'

const storeNavigation = [
	{ label: 'Resumen', icon: 'home', to: '/tienda', end: true },
	{ label: 'Solicitudes', icon: 'requests', to: '/tienda/solicitudes' },
	{ label: 'Mis propuestas', icon: 'proposal', to: '/tienda/propuestas' },
	{ label: 'Promociones', icon: 'promotion', to: '/tienda/promociones' },
	{ label: 'Reseñas', icon: 'star', to: '/tienda/resenas' },
	{ label: 'Mi tienda', icon: 'store', to: '/tienda/perfil' },
	{ label: 'Categorías', icon: 'categories', to: '/tienda/categorias' },
	{ label: 'Favoritos', icon: 'heart', to: '/tienda/favoritos' },
	{ label: 'Mi cuenta', icon: 'user', to: '/cuenta', desktopOnly: true },
]

function StoreSidebar() {
	const navigate = useNavigate()
	const { signOut } = useAuth()
	const navRef = useRef(null)
	useBottomBar(navRef)

	async function handleSignOut() {
		if (await signOut()) navigate('/login')
	}

	return (
		<aside className="store-sidebar" aria-label="Menú de tienda">
			<Link className="store-brand" to="/tienda"><BrandLogo /></Link>
			<div className="store-sidebar-intro">
				<span className="store-sidebar-mark">Tienda</span>
				<p>Administra tu presencia en DriveFix.</p>
			</div>
			<nav className="store-navigation" ref={navRef} aria-label="Secciones de tienda">
				{storeNavigation.map((item) => (
					<NavLink className={`store-navigation-link${item.desktopOnly ? ' is-desktop-only' : ''}`} to={item.to} end={item.end} key={item.label}>
						<span className="store-navigation-icon"><Icon name={item.icon} /></span>
						<span>{item.label}</span>
					</NavLink>
				))}
			</nav>
			<div className="store-sidebar-footer">
				<span>Espacio de tienda</span>
				<Link className="client-sidebar-logout" to="/tienda/editar">Editar información</Link>
				<button className="client-sidebar-logout" type="button" onClick={handleSignOut}>Cerrar sesión</button>
			</div>
		</aside>
	)
}

export default StoreSidebar
