import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { useAuth } from '../../context/authState.js'
import { obtenerTiendaUsuario } from '../../services/tiendaService.js'
import { obtenerResumenTienda } from '../../services/dashboardService.js'
import StatStrip from '../../components/ui/StatStrip.jsx'

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
	if (store.estado === 'pendiente') return { tone: 'info', text: 'Tu tienda está en revisión. Mientras tanto puedes preparar tus categorías y completar tu perfil.', action: { to: '/tienda/categorias', label: 'Elegir categorías' } }
	if (store.estado === 'rechazada') return { tone: 'warn', text: `Tu tienda fue rechazada${reason(store.motivo_estado)} Actualiza tu información para una nueva revisión.`, action: { to: '/tienda/editar', label: 'Editar información' } }
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
	useEffect(() => {
		let active = true
		// Si falla la carga, store queda en undefined: no se muestra «Completa el perfil» por error.
		obtenerTiendaUsuario(user.id).then((data) => { if (active) setStore(data) }).catch(() => { if (active) setLoadError(true) })
		obtenerResumenTienda().then((data) => { if (active) setStats(data) }).catch(() => { if (active) setLoadError(true) }).finally(() => { if (active) setStatsLoading(false) })
		return () => { active = false }
	}, [user.id, reload])
	function retry() { setLoadError(false); setStatsLoading(true); setReload((value) => value + 1) }
	const statItems = [
		{ label: 'Solicitudes sin responder', value: stats?.solicitudes_nuevas, to: '/tienda/solicitudes', highlight: Number(stats?.solicitudes_nuevas) > 0 },
		{ label: 'Propuestas en espera', value: stats?.propuestas_enviadas, to: '/tienda/propuestas' },
		{ label: 'Propuestas seleccionadas', value: stats?.propuestas_seleccionadas, to: '/tienda/propuestas' },
		{ label: 'Promociones vigentes', value: stats?.promociones_activas, to: '/tienda/promociones' },
		{ label: 'Calificación', value: stats?.calificacion, decimals: 1, suffix: ' / 5', hint: stats ? `${stats.resenas} ${Number(stats.resenas) === 1 ? 'reseña' : 'reseñas'}` : '', to: '/tienda/resenas' },
	]
	const notice = store === undefined ? null : storeNotice(store)

	return (
		<section className="store-page store-dashboard">
			<div className="store-hero">
				<p className="store-eyebrow">Panel de tienda</p>
				<h1>{store?.nombre ? <>Hola, <em>{store.nombre}</em></> : 'Bienvenido a tu tienda'}</h1>
				<p className="store-lead">Responde solicitudes, publica promociones y mantén tu tienda al día desde un solo lugar.</p>
				{store?.estado === 'aprobada' && store.activa && <span className="admin-status admin-status-aprobada store-hero-status">Tienda aprobada y visible</span>}
			</div>
			{loadError && <div className="request-history-notice store-notice" role="alert"><span>No se pudo cargar toda la información de tu panel. Comprueba tu conexión.</span><button className="button button-secondary" type="button" onClick={retry}>Reintentar</button></div>}
			<StatStrip items={statItems} loading={statsLoading} />
			{notice && <div className={notice.tone === 'info' ? 'store-request-message store-notice' : 'request-history-notice store-notice'} role="status">
				<span>{notice.text}</span>
				{notice.action && <Link className="button button-secondary" to={notice.action.to}>{notice.action.label}</Link>}
			</div>}
			<div className="store-actions">
				{actions.map((action, index) => <Link className="store-action-card" to={action.to} key={action.to}>
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
