import { Link, NavLink } from 'react-router-dom'

const storeNavigation = [
	{ label: 'Resumen', icon: '⌂', to: '/tienda', end: true },
	{ label: 'Mi tienda', icon: '▣', to: '/tienda/perfil' },
	{ label: 'Categorías que atiendo', icon: '◈', to: '/tienda/categorias' },
	{ label: 'Solicitudes disponibles', icon: '▤', to: '/tienda/solicitudes' },
	{ label: 'Promociones', icon: '％', to: '/tienda/promociones' },
	{ label: 'Favoritos', icon: '♡', to: '/tienda/favoritos' },
	{ label: 'Editar información', icon: '✎', to: '/tienda/editar' },
]

function StoreSidebar() {
	return (
		<aside className="store-sidebar" aria-label="Menú de tienda">
			<Link className="store-brand" to="/tienda">
				<span>R</span>
				<strong>Repuestos</strong> Pro
			</Link>
			<div className="store-sidebar-intro">
				<span className="store-sidebar-mark">TIENDA</span>
				<p>Administra tu presencia<br />en RepuestosPro.</p>
			</div>
			<nav className="store-navigation">
				{storeNavigation.map((item) => (
					<NavLink className="store-navigation-link" to={item.to} end={item.end} key={item.label}>
						<span className="store-navigation-icon">{item.icon}</span>
						<span>{item.label}</span>
					</NavLink>
				))}
			</nav>
			<div className="store-sidebar-footer">
				<span>HU-2</span>
				<p>Gestión de<br />tu tienda</p>
			</div>
		</aside>
	)
}

export default StoreSidebar
