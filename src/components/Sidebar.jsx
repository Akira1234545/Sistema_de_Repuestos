import { NavLink } from 'react-router-dom'

const navigationItems = [
	{ label: 'Inicio', icon: '⌂', to: '/cliente', end: true },
	{ label: 'Explorar', icon: '⌕', to: null },
	{ label: 'Solicitudes', icon: '▤', to: '/cliente/solicitudes' },
	{ label: 'Vehículos', icon: '▱', to: '/cliente/vehiculos' },
	{ label: 'Favoritos', icon: '♡', to: null },
	{ label: 'Notificaciones', icon: '♢', to: null },
	{ label: 'Mensajes', icon: '◌', to: null },
]

function Sidebar() {
	return (
		<aside className="client-sidebar" aria-label="Menú del cliente">
			<p className="sidebar-label">Mi espacio</p>
			<nav>
				{navigationItems.map((item) => item.to ? (
					<NavLink className="sidebar-link" to={item.to} end={item.end} key={item.label}><span className="sidebar-icon">{item.icon}</span>{item.label}</NavLink>
				) : (
					<span className="sidebar-link sidebar-link-disabled" aria-disabled="true" key={item.label}><span className="sidebar-icon">{item.icon}</span>{item.label}</span>
				))}
			</nav>
			<div className="sidebar-note"><span>RepuestosPro</span><p>Tu vehículo,<br />en buenas manos.</p></div>
		</aside>
	)
}

export default Sidebar
