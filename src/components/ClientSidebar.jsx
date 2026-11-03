import Icon from './Icon.jsx'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authState.js'

const clientNavigation = [
	{ label: 'Inicio', icon: 'home', to: '/cliente', end: true },
	{ label: 'Solicitudes', icon: 'requests', to: '/cliente/solicitudes' },
	{ label: 'Vehículos', icon: 'vehicle', to: '/cliente/vehiculos' },
	{ label: 'Promociones', icon: 'promotion', to: '/promociones' },
	{ label: 'Tiendas', icon: 'store', to: '/tiendas' },
	{ label: 'Favoritos', icon: 'heart', to: '/cliente/favoritos' },
	{ label: 'Mi cuenta', icon: 'user', to: '/cuenta' },
]

function ClientSidebar() {
	const navigate = useNavigate()
	const { signOut } = useAuth()

	async function handleSignOut() {
		if (await signOut()) navigate('/login')
	}

	return (
		<aside className="client-sidebar" aria-label="Menú de cliente">
			<Link className="client-brand" to="/cliente"><span aria-hidden="true">R</span>Repuestos<strong>Pro</strong></Link>
			<div className="client-sidebar-intro">
				<span className="client-sidebar-mark">Cliente</span>
				<p>Todo lo que necesitas para tu vehículo.</p>
			</div>
			<nav className="client-navigation" aria-label="Secciones de cliente">
				{clientNavigation.map((item) => (
					<NavLink className="client-navigation-link" to={item.to} end={item.end} key={item.label}>
						<span className="client-navigation-icon"><Icon name={item.icon} /></span><span>{item.label}</span>
					</NavLink>
				))}
			</nav>
			<div className="client-sidebar-footer"><span>RepuestosPro</span><p>Tu vehículo, en buenas manos.</p><button className="client-sidebar-logout" type="button" onClick={handleSignOut}>Cerrar sesión</button></div>
		</aside>
	)
}

export default ClientSidebar
