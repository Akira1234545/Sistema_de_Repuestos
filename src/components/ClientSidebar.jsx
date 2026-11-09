import Icon from './Icon.jsx'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useRef } from 'react'
import { useAuth } from '../context/authState.js'
import { useBottomBar } from '../hooks/useBottomBar.js'
import BrandLogo from './BrandLogo.jsx'

const clientNavigation = [
	{ label: 'Inicio', icon: 'home', to: '/cliente', end: true },
	{ label: 'Solicitudes', icon: 'requests', to: '/cliente/solicitudes' },
	{ label: 'Vehículos', icon: 'vehicle', to: '/cliente/vehiculos' },
	{ label: 'Promociones', icon: 'promotion', to: '/promociones' },
	{ label: 'Tiendas', icon: 'store', to: '/cliente/tiendas' },
	{ label: 'Favoritos', icon: 'heart', to: '/cliente/favoritos' },
	{ label: 'Mi cuenta', icon: 'user', to: '/cuenta', desktopOnly: true },
]

function ClientSidebar() {
	const navigate = useNavigate()
	const { signOut } = useAuth()
	const navRef = useRef(null)
	useBottomBar(navRef)

	async function handleSignOut() {
		if (await signOut()) navigate('/login')
	}

	return (
		<aside className="client-sidebar" aria-label="Menú de cliente">
			<Link className="client-brand" to="/cliente"><BrandLogo /></Link>
			<div className="client-sidebar-intro">
				<span className="client-sidebar-mark">Cliente</span>
				<p>Todo lo que necesitas para tu vehículo.</p>
			</div>
			<nav className="client-navigation" ref={navRef} aria-label="Secciones de cliente">
				{clientNavigation.map((item) => (
					<NavLink className={`client-navigation-link${item.desktopOnly ? ' is-desktop-only' : ''}`} to={item.to} end={item.end} key={item.label}>
						<span className="client-navigation-icon"><Icon name={item.icon} /></span><span>{item.label}</span>
					</NavLink>
				))}
			</nav>
			<div className="client-sidebar-footer"><span>DriveFix</span><p>Tu vehículo, en buenas manos.</p><button className="client-sidebar-logout" type="button" onClick={handleSignOut}>Cerrar sesión</button></div>
		</aside>
	)
}

export default ClientSidebar
