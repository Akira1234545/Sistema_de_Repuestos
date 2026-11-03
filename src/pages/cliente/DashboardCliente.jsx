import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import StatStrip from '../../components/ui/StatStrip.jsx'
import { useAuth } from '../../context/authState.js'
import { obtenerResumenCliente } from '../../services/dashboardService.js'

const quickActions = [
	{ icon: 'requests', title: 'Nueva solicitud', text: 'Cuenta qué repuesto necesitas y recibe propuestas.', to: '/cliente/solicitudes/crear' },
	{ icon: 'vehicle', title: 'Mis vehículos', text: 'Administra los vehículos que tienes registrados.', to: '/cliente/vehiculos' },
	{ icon: 'promotion', title: 'Promociones', text: 'Consulta descuentos activos de las tiendas.', to: '/promociones' },
	{ icon: 'store', title: 'Tiendas', text: 'Conoce las tiendas aprobadas y sus reseñas.', to: '/cliente/tiendas' },
]

function greeting() {
	const hour = Number(new Intl.DateTimeFormat('es-BO', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/La_Paz' }).format(new Date()))
	return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
}

function nextStep(stats) {
	if (!stats) return null
	if (Number(stats.vehiculos) === 0) return { text: 'Registra tu primer vehículo para publicar solicitudes.', to: '/cliente/vehiculos/crear', label: 'Registrar vehículo' }
	if (Number(stats.propuestas_por_revisar) > 0) return { text: `Tienes ${stats.propuestas_por_revisar} ${Number(stats.propuestas_por_revisar) === 1 ? 'propuesta' : 'propuestas'} esperando tu decisión.`, to: '/cliente/solicitudes', label: 'Revisar propuestas' }
	if (Number(stats.solicitudes_abiertas) === 0) return { text: '¿Necesitas un repuesto? Publica una solicitud y las tiendas te responderán.', to: '/cliente/solicitudes/crear', label: 'Crear solicitud' }
	return { text: 'Tus solicitudes están publicadas. Te avisaremos en cuanto llegue una propuesta.', to: '/cliente/solicitudes', label: 'Ver solicitudes' }
}

function DashboardCliente() {
	const { profile } = useAuth()
	const [stats, setStats] = useState(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		let active = true
		obtenerResumenCliente().then((data) => { if (active) setStats(data) }).catch(() => {}).finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [])

	const step = nextStep(stats)
	const statItems = [
		{ label: 'Propuestas por revisar', value: stats?.propuestas_por_revisar, to: '/cliente/solicitudes', highlight: Number(stats?.propuestas_por_revisar) > 0 },
		{ label: 'Solicitudes abiertas', value: stats?.solicitudes_abiertas, to: '/cliente/solicitudes' },
		{ label: 'Vehículos', value: stats?.vehiculos, to: '/cliente/vehiculos' },
		{ label: 'Atenciones confirmadas', value: stats?.solicitudes_atendidas },
		{ label: 'Favoritos', value: stats?.favoritos, to: '/cliente/favoritos' },
	]

	return (
		<section className="client-dashboard">
			<div className="dashboard-heading">
				<div>
					<p className="dashboard-eyebrow">{greeting()}{profile?.nombre ? `, ${profile.nombre}` : ''}</p>
					<h1>Tu vehículo, <em>en buenas manos</em></h1>
					<p className="dashboard-lead">Publica lo que necesitas, compara propuestas y confirma la atención desde un solo lugar.</p>
				</div>
				<Link className="button button-lg" to="/cliente/solicitudes/crear">+ Nueva solicitud</Link>
			</div>
			<StatStrip items={statItems} loading={loading} />
			{step && <div className="dashboard-tip"><span aria-hidden="true">✦</span><div><strong>Siguiente paso</strong><p>{step.text}</p></div><Link to={step.to}>{step.label} →</Link></div>}
			<div className="quick-heading"><div><p className="dashboard-eyebrow">Accesos rápidos</p><h2>¿Qué necesitas hacer?</h2></div></div>
			<div className="quick-actions">
				{quickActions.map((action, index) => <Link className="quick-card" to={action.to} key={action.title}>
					<span className="quick-number">0{index + 1}</span>
					<span className="quick-icon"><Icon name={action.icon} size={22} /></span>
					<h3>{action.title}</h3>
					<p>{action.text}</p>
					<span className="quick-arrow" aria-hidden="true">↗</span>
				</Link>)}
			</div>
		</section>
	)
}

export default DashboardCliente
