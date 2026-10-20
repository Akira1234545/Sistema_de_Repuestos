import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import './DashboardCliente.css'

const quickActions = [
	{ icon: '▱', title: 'Mis vehículos', text: 'Administra los vehículos que tienes registrados.', to: '/cliente/vehiculos' },
	{ icon: '▤', title: 'Mis solicitudes', text: 'Revisa el estado de tus solicitudes de repuestos.', to: '/cliente/solicitudes' },
	{ icon: '％', title: 'Explorar promociones', text: 'Consulta descuentos activos de las tiendas.', to: '/promociones' },
	{ icon: '♡', title: 'Favoritos', text: 'Consulta tus tiendas, solicitudes y promociones guardadas.', to: '/cliente/favoritos' },
]

function DashboardCliente() {
	const { user, profile } = useAuth()
	const userName = profile?.nombre || user?.user_metadata?.nombre || user?.email || 'Cliente'

	return (
		<section className="client-dashboard">
			<div className="dashboard-heading">
				<div><p className="dashboard-eyebrow">Panel de cliente</p><h1>Bienvenido a <em>Repuestos Pro</em></h1><p className="dashboard-lead">Encuentra los repuestos que necesitas y gestiona tus solicitudes desde un solo lugar.</p></div>
				<div className="dashboard-date"><span>HOY</span><strong>Tu próximo viaje<br />empieza aquí.</strong></div>
			</div>
			<div className="dashboard-divider" />
			<div className="quick-heading"><div><p className="dashboard-eyebrow">Accesos rápidos</p><h2>¿Qué necesitas hacer, {userName}?</h2></div><span className="quick-count">04 opciones</span></div>
			<div className="quick-actions">
				{quickActions.map((action, index) => action.to ? (
					<Link className="quick-card" to={action.to} key={action.title}><span className="quick-number">0{index + 1}</span><span className="quick-icon">{action.icon}</span><h3>{action.title}</h3><p>{action.text}</p><span className="quick-arrow">↗</span></Link>
				) : (
					<div className="quick-card quick-card-disabled" key={action.title}><span className="quick-number">0{index + 1}</span><span className="quick-icon">{action.icon}</span><h3>{action.title}</h3><p>{action.text}</p><span className="coming-soon">Próximamente</span></div>
				))}
			</div>
			<div className="dashboard-tip"><span>✦</span><div><strong>Un buen mantenimiento hace la diferencia.</strong><p>Registra tus vehículos para recibir una experiencia más ordenada cuando busques repuestos.</p></div><Link to="/cliente/vehiculos">Ver mis vehículos ↗</Link></div>
		</section>
	)
}

export default DashboardCliente
