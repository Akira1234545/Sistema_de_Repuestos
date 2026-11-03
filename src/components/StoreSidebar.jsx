import Icon from './Icon.jsx'
import { Link, NavLink } from 'react-router-dom'

const storeNavigation = [
    { label: 'Mis propuestas', icon: 'proposal', to: '/tienda/propuestas' },
	{ label: 'Resumen', icon: 'home', to: '/tienda', end: true },
	{ label: 'Mi tienda', icon: 'store', to: '/tienda/perfil' },
	{ label: 'Categorías que atiendo', icon: 'categories', to: '/tienda/categorias' },
	{ label: 'Solicitudes disponibles', icon: 'requests', to: '/tienda/solicitudes' },
	{ label: 'Promociones', icon: 'promotion', to: '/tienda/promociones' },
	{ label: 'Reseñas recibidas', icon: 'star', to: '/tienda/resenas' },
	{ label: 'Favoritos', icon: 'heart', to: '/tienda/favoritos' },
	{ label: 'Editar información', icon: 'edit', to: '/tienda/editar' },
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
						<span className="store-navigation-icon"><Icon name={item.icon} /></span>
						<span>{item.label}</span>
					</NavLink>
				))}
			</nav>
			<div className="store-sidebar-footer">
				<span>ESPACIO DE TIENDA</span>
				<p>Gestión de<br />tu tienda</p>
			</div>
		</aside>
	)
}

export default StoreSidebar
