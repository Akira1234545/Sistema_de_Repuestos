import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { useAuth } from '../../context/authState.js'
import { obtenerTiendaUsuario } from '../../services/tiendaService.js'
import { obtenerResumenTienda } from '../../services/dashboardService.js'
import { ActivityCard, KpiRow, PanelGreeting, PanelHero, PeriodControl } from '../../components/panel/PanelHome.jsx'
import ActivityChart from '../../components/panel/ActivityChart.jsx'
import { useDashboardSeries } from '../../hooks/useDashboardSeries.js'
import { obtenerNotificaciones } from '../../services/notificacionService.js'
import { latestNotifications, notificationPath, trendFor } from '../../lib/panel.js'

const activityIcons = { nueva_solicitud: 'requests', propuesta_seleccionada: 'star', cambio_estado_propuesta: 'proposal', cambio_estado_solicitud: 'requests', cambio_estado_tienda: 'store', promocion: 'promotion' }

const actions = [
	{ to: '/tienda/solicitudes', icon: 'requests', title: 'Solicitudes disponibles', text: 'Revisa las solicitudes de repuestos de tus categorías.' },
	{ to: '/tienda/propuestas', icon: 'proposal', title: 'Mis propuestas', text: 'Sigue tus cotizaciones y las selecciones de los clientes.' },
	{ to: '/tienda/promociones', icon: 'promotion', title: 'Promociones', text: 'Publica y administra descuentos de tu tienda.' },
	{ to: '/tienda/resenas', icon: 'star', title: 'Reseñas recibidas', text: 'Consulta las calificaciones y comentarios de tus clientes.' },
	{ to: '/tienda/categorias', icon: 'categories', title: 'Categorías que atiendo', text: 'Define qué solicitudes puedes consultar y responder.' },
	{ to: '/tienda/perfil', icon: 'store', title: 'Mi tienda', text: 'Consulta la información y fotografías de tu tienda.' },
]

// Ends the admin's reason with a full stop so the sentence that follows reads correctly.
const reason = (text) => text ? `: ${text.trim().replace(/[.!?]?$/, '.')}` : '.'

function storeNotice(store) {
	if (!store) return { tone: 'warn', text: 'Completa el perfil de tu tienda para que el equipo pueda revisarla.', action: { to: '/tienda/editar', label: 'Crear mi tienda' } }
	if (store.estado === 'pendiente') return { tone: 'info', text: 'Enviada a revisión: un administrador revisará tu tienda y te avisaremos con una notificación. Mientras tanto puedes preparar tus categorías y completar tu perfil.', action: { to: '/tienda/categorias', label: 'Elegir categorías' } }
	if (store.estado === 'rechazada') return { tone: 'warn', text: `Tu tienda fue rechazada${reason(store.motivo_estado)} Al guardar cambios en tu información, la tienda se envía de nuevo a revisión.`, action: { to: '/tienda/editar', label: 'Editar información' } }
	if (store.estado === 'suspendida' || !store.activa) return { tone: 'warn', text: `Tu tienda está suspendida${reason(store.motivo_estado)} Contacta con soporte para reactivarla.` }
	return null
}

function DashboardTienda() {
	const { user } = useAuth()
	const [store, setStore] = useState(undefined)
	const [stats, setStats] = useState(null)
	const [statsLoading, setStatsLoading] = useState(true)
	const [loadError, setLoadError] = useState(false)
	const [reload, setReload] = useState(0)
	const [activity, setActivity] = useState({ items: [], loading: true, error: '' })
	const trends = useDashboardSeries(reload)
	const trend = (key, nouns) => (trends.available ? trendFor(trends.series, key, trends.days, nouns) : null)
	useEffect(() => {
		let active = true
		// Si falla la carga, store queda en undefined: no se muestra «Completa el perfil» por error.
		obtenerTiendaUsuario(user.id).then((data) => { if (active) setStore(data) }).catch(() => { if (active) setLoadError(true) })
		obtenerResumenTienda().then((data) => { if (active) setStats(data) }).catch(() => { if (active) setLoadError(true) }).finally(() => { if (active) setStatsLoading(false) })
		obtenerNotificaciones()
			.then(({ notifications }) => { if (active) setActivity({ items: latestNotifications(notifications), loading: false, error: '' }) })
			.catch(() => { if (active) setActivity({ items: [], loading: false, error: 'No se pudo cargar la actividad.' }) })
		return () => { active = false }
	}, [user.id, reload])
	function retry() { setLoadError(false); setStatsLoading(true); setActivity((current) => ({ ...current, loading: true, error: '' })); setReload((value) => value + 1) }

	const fresh = Number(stats?.solicitudes_nuevas) || 0
	const waiting = Number(stats?.propuestas_enviadas) || 0
	const chosen = Number(stats?.propuestas_seleccionadas) || 0
	const reviews = Number(stats?.resenas) || 0
	const kpis = [
		{ label: 'Solicitudes nuevas', icon: 'requests', value: stats?.solicitudes_nuevas, to: '/tienda/solicitudes', highlight: true, hint: 'Sin responder en tus categorías', trend: trend('solicitudes_publicadas', ['publicada', 'publicadas']) },
		{ label: 'Propuestas en espera', icon: 'proposal', value: stats?.propuestas_enviadas, to: '/tienda/propuestas', trend: trend('propuestas_enviadas', ['enviada', 'enviadas']) },
		{ label: 'Seleccionadas', icon: 'star', value: stats?.propuestas_seleccionadas, to: '/tienda/propuestas', trend: trend('propuestas_seleccionadas', ['elegida', 'elegidas']) },
		{ label: 'Calificación', icon: 'star', value: stats?.calificacion, decimals: 1, suffix: '★', hint: stats ? `${reviews} ${reviews === 1 ? 'reseña' : 'reseñas'}` : '', to: '/tienda/resenas' },
	]
	const activityItems = activity.items.map((item) => ({
		id: item.id, title: item.titulo, text: item.mensaje, date: item.fecha_creacion, unread: !item.leida,
		icon: activityIcons[item.tipo] || 'bell', to: notificationPath(item, 'tienda') || undefined,
	}))
	const notice = store === undefined ? null : storeNotice(store)

	return (
		<section className="store-page store-dashboard panel-home">
			{/* Q10: una tienda rechazada o suspendida cuenta como «algo necesita tu atención». */}
			<PanelGreeting name={store?.nombre} attention={stats ? fresh + (notice?.tone === 'warn' ? 1 : 0) : null} loading={statsLoading}>
				{store?.estado === 'aprobada' && store.activa && <span className="admin-status admin-status-aprobada store-hero-status">Tienda aprobada y visible</span>}
			</PanelGreeting>
			{loadError && <div className="request-history-notice store-notice" role="alert"><span>No se pudo cargar toda la información de tu panel. Comprueba tu conexión.</span><button className="button button-secondary" type="button" onClick={retry}>Reintentar</button></div>}
			{notice && <div className={notice.tone === 'info' ? 'store-request-message store-notice' : 'request-history-notice store-notice'} role="status">
				<span>{notice.text}</span>
				{notice.action && <Link className="button button-secondary" to={notice.action.to}>{notice.action.label}</Link>}
			</div>}
			<div className="panel-home-top">
				<PanelHero id="store-hero-title" loading={statsLoading}
					kicker="Panel de tienda"
					title={fresh > 0 ? `Hay ${fresh} ${fresh === 1 ? 'solicitud nueva' : 'solicitudes nuevas'} para ti` : 'Estás al día con las solicitudes'}
					lead="Responde solicitudes, publica promociones y mantén tu tienda al día desde un solo lugar."
					metrics={[
						{ label: 'En espera', value: stats?.propuestas_enviadas },
						{ label: 'Promociones vigentes', value: stats?.promociones_activas },
						{ label: 'Reseñas', value: stats?.resenas },
					]}
					ring={{ value: chosen, total: waiting + chosen, label: 'seleccionadas', caption: waiting + chosen > 0 ? `${chosen} de ${waiting + chosen} propuestas (en espera o seleccionadas) fueron elegidas por el cliente.` : 'Cuando envíes propuestas verás aquí cuántas eligen los clientes.' }}
					actions={<>
						<Link className="button" to="/tienda/solicitudes"><Icon name="requests" size={18} /> Ver solicitudes</Link>
						<Link className="button button-secondary" to="/tienda/promociones/crear"><Icon name="promotion" size={18} /> Crear promoción</Link>
					</>} />
				<ActivityCard items={activityItems} loading={activity.loading} error={activity.error} onRetry={retry}
					empty="Todavía no hay avisos. Aquí verás las solicitudes nuevas y las propuestas elegidas." />
			</div>
			{trends.available && <PeriodControl days={trends.days} onChange={trends.setDays} busy={trends.loading} />}
			<KpiRow items={kpis} loading={statsLoading} label="Resumen de tu tienda" />
			{trends.available && <ActivityChart title="Actividad por día" days={trends.days} series={trends.series} loading={trends.loading} error={trends.error} onRetry={retry}
				options={[
					{ key: 'solicitudes_publicadas', label: 'Solicitudes en tus categorías', short: 'Solicitudes' },
					{ key: 'propuestas_enviadas', label: 'Propuestas enviadas', short: 'Enviadas' },
					{ key: 'propuestas_seleccionadas', label: 'Propuestas elegidas', short: 'Elegidas' },
				]} />}
			<div className="quick-heading"><div><p className="store-eyebrow">Accesos rápidos</p><h2>Tu tienda</h2></div></div>
			<div className="store-actions">
				{actions.map((action, index) => <Link className="store-action-card glass-card" to={action.to} key={action.to}>
					<span>{String(index + 1).padStart(2, '0')}</span>
					<span className="quick-icon"><Icon name={action.icon} size={22} /></span>
					<strong>{action.title}</strong>
					<p>{action.text}</p>
					<b aria-hidden="true">↗</b>
				</Link>)}
			</div>
		</section>
	)
}

export default DashboardTienda
