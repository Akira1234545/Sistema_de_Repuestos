import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { ActivityCard, KpiRow, PanelGreeting, PanelHero, PeriodControl } from '../../components/panel/PanelHome.jsx'
import ActivityChart from '../../components/panel/ActivityChart.jsx'
import { useDashboardSeries } from '../../hooks/useDashboardSeries.js'
import { useAuth } from '../../context/authState.js'
import { obtenerResumenCliente } from '../../services/dashboardService.js'
import { obtenerNotificaciones } from '../../services/notificacionService.js'
import { latestNotifications, notificationPath, trendFor } from '../../lib/panel.js'

const quickActions = [
	{ icon: 'requests', title: 'Nueva solicitud', text: 'Cuenta qué repuesto necesitas y recibe propuestas.', to: '/cliente/solicitudes/crear' },
	{ icon: 'vehicle', title: 'Mis vehículos', text: 'Administra los vehículos que tienes registrados.', to: '/cliente/vehiculos' },
	{ icon: 'promotion', title: 'Promociones', text: 'Consulta descuentos activos de las tiendas.', to: '/promociones' },
	{ icon: 'store', title: 'Tiendas', text: 'Conoce las tiendas aprobadas y sus reseñas.', to: '/cliente/tiendas' },
]

const activityIcons = { nueva_propuesta: 'proposal', propuesta_seleccionada: 'star', cambio_estado_solicitud: 'requests', cambio_estado_propuesta: 'proposal', promocion: 'promotion' }

function nextStep(stats) {
	if (!stats) return null
	if (Number(stats.vehiculos) === 0) return { text: 'Registra tu primer vehículo para publicar solicitudes.', to: '/cliente/vehiculos/crear', label: 'Registrar vehículo' }
	if (Number(stats.propuestas_por_revisar) > 0) return { text: `Tienes ${stats.propuestas_por_revisar} ${Number(stats.propuestas_por_revisar) === 1 ? 'propuesta' : 'propuestas'} esperando tu decisión.`, to: '/cliente/solicitudes', label: 'Revisar propuestas' }
	if (Number(stats.solicitudes_abiertas) === 0) return { text: '¿Necesitas un repuesto? Publica una solicitud y las tiendas te responderán.', to: '/cliente/solicitudes/crear', label: 'Crear solicitud' }
	// Q11 (sesión 8): el título ya dice «Tus solicitudes están publicadas»; el texto no lo repite.
	return { text: 'Las tiendas de esas categorías ya pueden verlas. Te avisaremos en cuanto llegue una propuesta.', to: '/cliente/solicitudes', label: 'Ver solicitudes' }
}

function DashboardCliente() {
	const { profile } = useAuth()
	const [stats, setStats] = useState(null)
	const [loading, setLoading] = useState(true)
	const [loadError, setLoadError] = useState(false)
	const [reload, setReload] = useState(0)
	const [activity, setActivity] = useState({ items: [], loading: true, error: '' })
	const trends = useDashboardSeries(reload)
	const trend = (key, nouns) => (trends.available ? trendFor(trends.series, key, trends.days, nouns) : null)

	useEffect(() => {
		let active = true
		obtenerResumenCliente().then((data) => { if (active) setStats(data) }).catch(() => { if (active) setLoadError(true) }).finally(() => { if (active) setLoading(false) })
		obtenerNotificaciones()
			.then(({ notifications }) => { if (active) setActivity({ items: latestNotifications(notifications), loading: false, error: '' }) })
			.catch(() => { if (active) setActivity({ items: [], loading: false, error: 'No se pudo cargar tu actividad.' }) })
		return () => { active = false }
	}, [reload])
	function retry() { setLoadError(false); setLoading(true); setActivity((current) => ({ ...current, loading: true, error: '' })); setReload((value) => value + 1) }

	const step = nextStep(stats)
	const pending = Number(stats?.propuestas_por_revisar) || 0
	const open = Number(stats?.solicitudes_abiertas) || 0
	const served = Number(stats?.solicitudes_atendidas) || 0
	const kpis = [
		{ label: 'Vehículos', icon: 'vehicle', value: stats?.vehiculos, to: '/cliente/vehiculos' },
		{ label: 'Solicitudes abiertas', icon: 'requests', value: stats?.solicitudes_abiertas, to: '/cliente/solicitudes', trend: trend('solicitudes_creadas', ['publicada', 'publicadas']) },
		{ label: 'Propuestas por revisar', icon: 'proposal', value: stats?.propuestas_por_revisar, to: '/cliente/solicitudes', highlight: true, trend: trend('propuestas_recibidas', ['recibida', 'recibidas']) },
		{ label: 'Favoritos', icon: 'heart', value: stats?.favoritos, to: '/cliente/favoritos' },
	]
	const activityItems = activity.items.map((item) => ({
		id: item.id, title: item.titulo, text: item.mensaje, date: item.fecha_creacion, unread: !item.leida,
		icon: activityIcons[item.tipo] || 'bell', to: notificationPath(item, 'cliente') || undefined,
	}))

	return (
		<section className="client-dashboard panel-home">
			<PanelGreeting name={profile?.nombre} attention={loadError ? null : pending} loading={loading} />
			{loadError && <div className="request-history-notice store-notice" role="alert"><span>No se pudo cargar tu resumen. Comprueba tu conexión.</span><button className="button button-secondary" type="button" onClick={retry}>Reintentar</button></div>}
			<div className="panel-home-top">
				<PanelHero id="client-hero-title" loading={loading}
					kicker="Tus solicitudes"
					title={pending > 0 ? 'Tus solicitudes avanzan' : open > 0 ? 'Tus solicitudes están publicadas' : 'Pide tu próximo repuesto'}
					lead={step?.text || 'Publica lo que necesitas, compara propuestas y confirma la atención desde un solo lugar.'}
					metrics={[
						{ label: 'Abiertas', value: stats?.solicitudes_abiertas },
						{ label: 'Atendidas', value: stats?.solicitudes_atendidas },
						{ label: 'Por revisar', value: stats?.propuestas_por_revisar },
					]}
					ring={{ value: served, total: open + served, label: 'atendidas', caption: open + served > 0 ? `${served} de ${open + served} solicitudes (abiertas y atendidas) ya fueron atendidas.` : 'Aún no tienes solicitudes abiertas ni atendidas.' }}
					actions={<>
						<Link className="button" to="/cliente/solicitudes/crear"><Icon name="plus" size={18} /> Nueva solicitud</Link>
						<Link className="button button-secondary" to={step?.to && step.to !== '/cliente/solicitudes/crear' ? step.to : '/cliente/solicitudes'}>{pending > 0 ? 'Ver propuestas' : 'Ver solicitudes'}</Link>
					</>} />
				<ActivityCard items={activityItems} loading={activity.loading} error={activity.error} onRetry={retry}
					empty="Todavía no hay avisos. Aquí verás las propuestas y los cambios de tus solicitudes." />
			</div>
			{trends.available && <PeriodControl days={trends.days} onChange={trends.setDays} busy={trends.loading} />}
			<KpiRow items={kpis} loading={loading} label="Tu resumen" />
			{trends.available && <ActivityChart title="Actividad por día" days={trends.days} series={trends.series} loading={trends.loading} error={trends.error} onRetry={retry}
				options={[
					{ key: 'propuestas_recibidas', label: 'Propuestas recibidas', short: 'Propuestas' },
					{ key: 'solicitudes_creadas', label: 'Solicitudes publicadas', short: 'Solicitudes' },
					{ key: 'solicitudes_atendidas', label: 'Solicitudes atendidas', short: 'Atendidas' },
				]} />}
			<div className="quick-heading"><div><p className="dashboard-eyebrow">Accesos rápidos</p><h2>¿Qué necesitas hacer?</h2></div></div>
			<div className="quick-actions">
				{quickActions.map((action, index) => <Link className="quick-card glass-card" to={action.to} key={action.title}>
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
