import { publicError } from '../lib/errors.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authState.js'
import { SIGN_OUT_CONFIRM, useConfirm } from '../context/confirmState.js'
import { useReverify } from '../context/reverifyState.js'
import { supabase } from '../services/supabase.js'
import AdminSettings from './AdminSettings.jsx'
import AdminUsers from './AdminUsers.jsx'
import AdminCategories from './AdminCategories.jsx'
import AdminRequests from './AdminRequests.jsx'
import AdminPromociones from './AdminPromociones.jsx'
import AdminReportes from './AdminReportes.jsx'
import { obtenerResumenAdministracion } from '../services/adminService.js'
import { ActivityCard, KpiRow, PanelGreeting, PanelHero, PeriodControl } from '../components/panel/PanelHome.jsx'
import ActivityChart from '../components/panel/ActivityChart.jsx'
import { useDashboardSeries } from '../hooks/useDashboardSeries.js'
import { usePanelLens, useSlidingPill } from '../hooks/usePanelShell.js'
import { initials, trendFor } from '../lib/panel.js'
import Icon from '../components/Icon.jsx'
import { statusLabel } from '../lib/format.js'
import Select from '../components/ui/Select.jsx'
import BrandLogo from '../components/BrandLogo.jsx'

// statusLabel() is written for proposals («No seleccionada»); stores need their own words.
const storeStateLabels = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', suspendida: 'Suspendida' }
const storeStateLabel = (value) => storeStateLabels[value] || statusLabel(value)

// Admin home (sesión 7): greeting, hero with the share of approved stores, latest stores and 4 KPI.
// Store counts come from the store list this page already loads; the rest from get_dashboard_stats.
function AdminHome({ name, stores, storesLoading, onReviewStores, onOpenStore, onSection }) {
	const [stats, setStats] = useState(null)
	const [failed, setFailed] = useState(false)
	const [reload, setReload] = useState(0)
	useEffect(() => {
		let active = true
		obtenerResumenAdministracion().then((data) => { if (active) setStats(data) }).catch(() => { if (active) setFailed(true) })
		return () => { active = false }
	}, [reload])
	const loading = !stats && !failed
	const trends = useDashboardSeries(reload)
	const trend = (key, nouns) => (trends.available ? trendFor(trends.series, key, trends.days, nouns) : null)
	const pending = Number(stats?.tiendas_pendientes) || 0
	const approved = stores.filter((store) => store.estado === 'aprobada')
	const latest = stores.slice(0, 4)
	const kpis = [
		{ label: 'Tiendas por revisar', icon: 'store', value: stats?.tiendas_pendientes, highlight: true, onClick: onReviewStores, trend: trend('tiendas_nuevas', ['registrada', 'registradas']) },
		{ label: 'Cuentas registradas', icon: 'user', value: stats?.total_usuarios, onClick: () => onSection('usuarios'), trend: trend('usuarios_nuevos', ['nueva', 'nuevas']) },
		{ label: 'Solicitudes abiertas', icon: 'requests', value: stats?.solicitudes_activas, onClick: () => onSection('solicitudes'), trend: trend('solicitudes_creadas', ['publicada', 'publicadas']) },
		{ label: 'Propuestas enviadas', icon: 'proposal', value: stats?.total_propuestas, onClick: () => onSection('reportes'), trend: trend('propuestas_enviadas', ['enviada', 'enviadas']) },
	]
	return <div className="panel-home admin-home">
		<PanelGreeting name={name} attention={failed ? null : pending} loading={loading} />
		{failed && <div className="request-history-notice store-notice" role="alert"><span>No se pudo cargar el resumen del sistema.</span><button className="button button-secondary" type="button" onClick={() => { setFailed(false); setReload((value) => value + 1) }}>Reintentar</button></div>}
		<div className="panel-home-top">
			<PanelHero id="admin-hero-title" loading={loading || storesLoading}
				kicker="Administración"
				title={pending > 0 ? `${pending} ${pending === 1 ? 'tienda espera' : 'tiendas esperan'} revisión` : 'No hay tiendas esperando revisión'}
				lead="Gestiona cuentas, tiendas, categorías, solicitudes, promociones y la configuración del sistema."
				metrics={[
					{ label: 'Clientes', value: stats?.total_clientes },
					{ label: 'Tiendas activas', value: stats?.tiendas_activas },
					{ label: 'Promociones vigentes', value: stats?.promociones_activas },
				]}
				ring={{
					value: approved.length, total: stores.length, label: 'aprobadas',
					caption: stores.length ? `${approved.length} de ${stores.length} tiendas registradas están aprobadas.` : 'Todavía no hay tiendas registradas.',
					orbit: approved.slice(0, 6).map((store) => ({ key: store.id, label: initials(store.nombre), title: store.nombre })),
				}}
				actions={<>
					<button className="button" type="button" onClick={onReviewStores}><Icon name="store" size={18} /> Revisar tiendas</button>
					<button className="button button-secondary" type="button" onClick={() => onSection('reportes')}>Ver reportes</button>
				</>} />
			<ActivityCard title="Últimas tiendas registradas" loading={storesLoading} empty="Todavía no hay tiendas registradas."
				items={latest.map((store) => ({ id: store.id, title: store.nombre, text: storeStateLabel(store.estado), date: store.fecha_creacion, icon: 'store', unread: store.estado === 'pendiente', onClick: () => onOpenStore(store) }))} />
		</div>
		{trends.available && <PeriodControl days={trends.days} onChange={trends.setDays} busy={trends.loading} />}
		<KpiRow items={kpis} loading={loading} label="Resumen del sistema" />
		{trends.available && <ActivityChart title="Actividad de la plataforma" days={trends.days} series={trends.series} loading={trends.loading} error={trends.error} onRetry={() => setReload((value) => value + 1)}
			options={[
				{ key: 'solicitudes_creadas', label: 'Solicitudes publicadas', short: 'Solicitudes' },
				{ key: 'propuestas_enviadas', label: 'Propuestas enviadas', short: 'Propuestas' },
				{ key: 'usuarios_nuevos', label: 'Cuentas nuevas', short: 'Cuentas' },
				{ key: 'tiendas_nuevas', label: 'Tiendas registradas', short: 'Tiendas' },
			]} />}
	</div>
}

const sections = [
	['tiendas', 'Cuentas de tiendas'],
	['usuarios', 'Usuarios'],
	['categorias', 'Categorías'],
	['solicitudes', 'Solicitudes'],
	['promociones', 'Promociones'],
	['reportes', 'Reportes de actividad'],
	['configuracion', 'Configuración'],
]

const statuses = ['pendiente', 'aprobada', 'rechazada', 'suspendida']
const statusLabels = { pendiente: 'Pendientes', aprobada: 'Aprobadas', rechazada: 'Rechazadas', suspendida: 'Suspendidas' }
const columns = 'id, nombre, descripcion, telefono, direccion, latitud, longitud, horario, fotografias, activa, estado, motivo_estado, fecha_creacion, usuario_id'

function formatDate(value) {
	return value ? new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Sin fecha'
}

function AdminAccess() {
	const { role, profile, signOut, profileError } = useAuth()
	const confirm = useConfirm()
	const reverify = useReverify()
	const pageRef = useRef(null)
	const tabsRef = useRef(null)
	usePanelLens(pageRef)
	const [stores, setStores] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [busyId, setBusyId] = useState('')
	const [section, setSection] = useState('tiendas')
	const [filter, setFilter] = useState({ status: 'pendiente', search: '' })
	const [reasons, setReasons] = useState({})
	const [openStore, setOpenStore] = useState('')
	const captureTab = useSlidingPill(tabsRef, section)

	function goToSection(key) {
		captureTab()
		setSection(key)
		requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }))
	}
	function reviewStores() { setFilter((current) => ({ ...current, status: 'pendiente' })); goToSection('tiendas') }
	function showStore(store) { setFilter({ status: store.estado, search: '' }); setOpenStore(store.id); goToSection('tiendas') }

	const loadStores = useCallback(async () => {
		setLoading(true)
		setError('')
		const { data, error: loadError } = await supabase.from('tiendas').select(columns).order('fecha_creacion', { ascending: false })
		if (loadError) setError(`No se pudieron cargar las tiendas: ${publicError(loadError)}`)
		else setStores(data || [])
		setLoading(false)
	}, [])

	useEffect(() => { const timer = setTimeout(() => loadStores(), 0); return () => clearTimeout(timer) }, [loadStores])

	const visibleStores = useMemo(() => stores.filter((store) => {
		const term = filter.search.trim().toLocaleLowerCase()
		return (!filter.status || store.estado === filter.status)
			&& (!term || [store.nombre, store.telefono, store.direccion, store.motivo_estado].some((value) => value?.toLocaleLowerCase().includes(term)))
	}), [stores, filter])

	async function review(store, action) {
		const reason = reasons[store.id] || ''
		if (['rechazar', 'suspender'].includes(action) && !reason.trim()) {
			setError('Escribe el motivo antes de rechazar o suspender una tienda.')
			return
		}
		const verb = action === 'aprobar' ? 'Aprobar' : action === 'rechazar' ? 'Rechazar' : 'Suspender'
		const ok = await confirm({
			title: `¿${verb} la tienda «${store.nombre}»?`,
			message: action === 'aprobar' ? 'Será visible para los clientes y podrá responder solicitudes de sus categorías.'
				: action === 'rechazar' ? `La tienda dejará de ser visible y verá este motivo: «${reason.trim()}». Si edita su perfil, volverá a revisión.`
				: `La tienda dejará de ser visible y no podrá responder solicitudes. Motivo: «${reason.trim()}».`,
			confirmLabel: `${verb} tienda`, tone: action === 'aprobar' ? undefined : 'danger',
		})
		if (!ok) return
		if (action !== 'aprobar' && !(await reverify(`Vas a ${verb.toLowerCase()} la tienda «${store.nombre}».`))) return
		setBusyId(store.id)
		setError('')
		setNotice('')
		try {
			const { error: reviewError } = await supabase.rpc('sprint1_admin_review_store', {
				p_store_id: store.id,
				p_action: action,
				p_reason: reason.trim() || null,
			})
			if (reviewError) throw reviewError
			setNotice(`La tienda “${store.nombre}” fue ${action === 'aprobar' ? 'aprobada' : action === 'rechazar' ? 'rechazada' : 'suspendida'}.`)
			await loadStores()
		} catch (cause) {
			setError(`No se pudo actualizar la tienda: ${publicError(cause)}`)
		} finally {
			setBusyId('')
		}
	}

	return <main className="admin-page glass-scene" ref={pageRef}>
		{profileError && <p className="admin-alert" role="alert">{profileError}</p>}
		<header className="admin-heading"><div><Link className="brand admin-brand" to="/"><BrandLogo /></Link><p className="eyebrow">Administración</p><p className="admin-heading-title">Panel de administración</p><p>Sesión administrativa verificada ({role}).</p></div><div className="admin-header-actions"><button type="button" className="button button-secondary" onClick={async () => { if (await confirm(SIGN_OUT_CONFIRM)) void signOut() }}>Cerrar sesión</button><Link className="button button-secondary" to="/">Volver al inicio</Link></div></header>
		<AdminHome name={profile?.nombre} stores={stores} storesLoading={loading} onReviewStores={reviewStores} onOpenStore={showStore} onSection={goToSection} />
		<nav className="admin-tabs" aria-label="Administración del sistema" ref={tabsRef} onClickCapture={captureTab}>
			{sections.map(([key, text]) => <button key={key} className={section === key ? 'active' : ''} type="button" aria-current={section === key ? 'page' : undefined} onClick={(event) => {
				setSection(key)
				event.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
			}}>{section === key && <span className="admin-tab-pill" data-flip-id="admin-tab-pill" aria-hidden="true" />}<span>{text}</span></button>)}
		</nav>
			{section === 'usuarios' && <AdminUsers />}
			{section === 'categorias' && <AdminCategories />}
			{section === 'solicitudes' && <AdminRequests />}
			{section === 'promociones' && <AdminPromociones />}
			{section === 'reportes' && <AdminReportes />}
		{section === 'configuracion' && <AdminSettings />}
		{section === 'tiendas' && <>
		<h2 className="admin-section-title">Revisión de tiendas</h2>
		{error && <p className="admin-alert" role="alert">{error}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
		<div className="list-toolbar">
			<label className="list-search"><Icon name="search" size={18} /><input type="search" value={filter.search} onChange={(event) => setFilter((current) => ({ ...current, search: event.target.value }))} placeholder="Buscar tienda" aria-label="Buscar por tienda, teléfono o dirección" /></label>
			<Select className="list-toolbar-select" ariaLabel="Estado" value={filter.status} onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value }))} options={[{ value: '', label: 'Todas' }, ...statuses.map((status) => ({ value: status, label: statusLabels[status] }))]} />
			<button type="button" className="icon-action" onClick={loadStores} disabled={loading} aria-label="Actualizar" title="Actualizar"><Icon name="refresh" size={18} /></button>
		</div>
		{loading ? <p role="status">Cargando tiendas…</p> : visibleStores.length === 0 ? <section className="admin-empty"><h2>No hay tiendas para mostrar</h2><p>Prueba con otro estado o término de búsqueda.</p></section> : <div className="admin-store-list compact-rows">{visibleStores.map((store) => <article className={`admin-store-card admin-store-row${openStore === store.id ? ' is-expanded' : ''}`} key={store.id}>
			<button type="button" className="admin-store-summary" aria-expanded={openStore === store.id} onClick={() => setOpenStore((current) => current === store.id ? '' : store.id)}>
				<span className="admin-user-avatar" aria-hidden="true">{store.fotografias?.[0] ? <img src={store.fotografias[0]} alt="" loading="lazy" /> : store.nombre?.charAt(0)?.toUpperCase()}</span>
				<span className="compact-row-text"><strong>{store.nombre}</strong><span>{store.activa ? 'Activa' : 'Inactiva'} · {formatDate(store.fecha_creacion)}</span></span>
				<span className={`admin-status admin-status-${store.estado}`}>{storeStateLabel(store.estado)}</span>
				<span className="request-card-chevron" aria-hidden="true"><Icon name="chevron" size={16} /></span>
			</button>
			{openStore === store.id && <div className="admin-store-body">
			<p>{store.descripcion || 'Sin descripción.'}</p><dl><div><dt>Teléfono</dt><dd>{store.telefono || 'No registrado'}</dd></div><div><dt>Dirección</dt><dd>{store.direccion || 'No registrada'}</dd></div><div><dt>Horario</dt><dd>{store.horario || 'No registrado'}</dd></div><div><dt>Ubicación</dt><dd>{store.latitud != null && store.longitud != null ? `${store.latitud}, ${store.longitud}` : 'No registrada'}</dd></div></dl>
			{store.motivo_estado && <p className="admin-reason"><strong>Último motivo:</strong> {store.motivo_estado}</p>}
			<label className="admin-reason-field">Motivo (obligatorio para rechazo o suspensión)<textarea value={reasons[store.id] || ''} onChange={(event) => setReasons((current) => ({ ...current, [store.id]: event.target.value }))} rows="2" maxLength="500" /></label>
			<div className="admin-actions">{store.estado !== 'aprobada' && <button className="button button-primary" type="button" onClick={() => review(store, 'aprobar')} disabled={Boolean(busyId)}>{busyId === store.id ? 'Guardando…' : store.estado === 'suspendida' ? 'Reactivar' : 'Aprobar'}</button>}{store.estado !== 'rechazada' && <button className="button button-secondary" type="button" onClick={() => review(store, 'rechazar')} disabled={Boolean(busyId)}>Rechazar</button>}{store.estado !== 'suspendida' && <button className="button button-danger" type="button" onClick={() => review(store, 'suspender')} disabled={Boolean(busyId)}>Suspender</button>}</div>
			</div>}
		</article>)}</div>}
		</>}
	</main>
}

export default AdminAccess
