import Icon from './Icon.jsx'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authState.js'

const clientNavigation = [
	{ label: 'Inicio', icon: 'home', to: '/cliente', end: true },
	{ label: 'Solicitudes', icon: 'requests', to: '/cliente/solicitudes' },
	{ label: 'Vehículos', icon: 'vehicle', to: '/cliente/vehiculos' },
	{ label: 'Promociones', icon: 'promotion', to: '/promociones' },
	{ label: 'Favoritos', icon: 'heart', to: '/cliente/favoritos' },
]

function ClientSidebar() {
	const navigate = useNavigate()
	const { signOut } = useAuth()

	async function handleSignOut() {
		if (await signOut()) navigate('/login')
	}

	return (
		<aside className="client-sidebar" aria-label="Menú de cliente">
			<a className="client-brand" href="/cliente">
				<span>R</span>
				<strong>Repuestos</strong> Pro
			</a>
			<div className="client-sidebar-intro">
				<span className="client-sidebar-mark">CLIENTE</span>
				<p>Todo lo que necesitas<br />para tu vehículo.</p>
			</div>
			<nav className="client-navigation">
				{clientNavigation.map((item) => item.to ? (
					<NavLink className="client-navigation-link" to={item.to} end={item.end} key={item.label}>
						<span className="client-navigation-icon"><Icon name={item.icon} /></span><span>{item.label}</span>
					</NavLink>
				) : (
					<span className="client-navigation-link client-navigation-disabled" aria-disabled="true" key={item.label}>
						<span className="client-navigation-icon"><Icon name={item.icon} /></span><span>{item.label}</span>
					</span>
				))}
			</nav>
			<div className="client-sidebar-footer"><span>RepuestosPro</span><p>Tu vehículo,<br />en buenas manos.</p><button className="client-sidebar-logout" type="button" onClick={handleSignOut}>Cerrar sesión <b>↗</b></button></div>
		</aside>
	)
}

export default ClientSidebar
