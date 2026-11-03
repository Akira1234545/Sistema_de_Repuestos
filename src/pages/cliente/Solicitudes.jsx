import { publicError } from '../../lib/errors.js'
import SkeletonList from '../../components/ui/Skeleton.jsx'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { useViewMode } from '../../hooks/useViewMode.js'
import Pagination from '../../components/Pagination.jsx'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import FavoriteToggle from '../../components/FavoriteToggle.jsx'
import Icon from '../../components/Icon.jsx'
import ViewSwitcher from '../../components/ui/ViewSwitcher.jsx'
import Select from '../../components/ui/Select.jsx'
import { useToast } from '../../context/toastState.js'
import { cerrarSolicitud, contarPropuestas, obtenerHistorialSolicitud, obtenerHistorialSolicitudes, obtenerSolicitudesUsuario } from '../../services/solicitudService.js'
import { statusLabel } from '../../lib/format.js'

const statuses = ['publicada', 'recibiendo_propuestas', 'propuesta_seleccionada', 'atendida', 'cerrada']
const OPEN_STATES = ['publicada', 'recibiendo_propuestas']
const VIEWS = [
	{ value: 'compacta', label: 'Vista compacta', icon: 'compact' },
	{ value: 'lista', label: 'Solo listado', icon: 'list' },
	{ value: 'detallada', label: 'Vista detallada', icon: 'detail' },
]
const emptyFilters = { search: '', status: '', from: '', to: '' }
function formatDate(value) { return new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function shortDate(value) { return new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', day: 'numeric', month: 'short' }).format(new Date(value)) }
function vehicleLabel(vehicle) { return vehicle ? [vehicle.marcaNombre, vehicle.modeloNombre, vehicle.anio].filter(Boolean).join(' ') : 'Vehículo no disponible' }

function RequestActions({ request, proposals, confirming, closing, onAskClose, onCancelClose, onClose }) {
	const open = OPEN_STATES.includes(request.estado)
	if (confirming) return <div className="request-confirm" role="group" aria-label="Confirmar cierre">
		<span>¿Cerrar esta solicitud?</span>
		<button type="button" className="icon-action is-danger is-wide" onClick={onClose} disabled={closing}>{closing ? 'Cerrando…' : 'Sí, cerrar'}</button>
		<button type="button" className="icon-action is-wide" onClick={onCancelClose} disabled={closing}>No</button>
	</div>
	return <div className="request-icon-actions">
		<FavoriteToggle type="solicitud" itemId={request.id} label="solicitud" iconOnly />
		<Link className="icon-action" to={`/cliente/solicitudes/${request.id}/propuestas`} aria-label={`Ver propuestas (${proposals || 0})`} title="Ver propuestas">
			<Icon name="eye" size={18} />{proposals > 0 && <span className="icon-badge">{proposals}</span>}
		</Link>
		{open && <Link className="icon-action" to={`/cliente/solicitudes/editar/${request.id}`} aria-label="Editar solicitud" title="Editar"><Icon name="edit" size={18} /></Link>}
		{open && <button className="icon-action is-danger" type="button" onClick={onAskClose} aria-label="Cerrar solicitud" title="Cerrar solicitud"><Icon name="close" size={18} /></button>}
	</div>
}

function RequestDetail({ request, history }) {
	return <div className="request-detail">
		<div className="request-meta"><span><strong>Vehículo:</strong> {vehicleLabel(request.vehiculo)}</span><span><strong>Categoría:</strong> {request.categoriaNombre || 'Sin categoría'}</span><span><strong>Cantidad:</strong> {request.cantidad}</span><span><strong>Creada:</strong> {formatDate(request.fecha_creacion)}</span></div>
		{request.descripcion && <p className="request-description">{request.descripcion}</p>}
		<section className="request-timeline" aria-label={`Historial de ${request.titulo}`}><h3>Historial de estado</h3>{history?.length ? <ol>{history.map((event) => <li key={event.id}><span>{event.estado_anterior ? `${statusLabel(event.estado_anterior)} → ` : ''}{statusLabel(event.estado_nuevo)}</span><time dateTime={event.fecha}>{formatDate(event.fecha)}</time></li>)}</ol> : <p>Sin cambios de estado registrados.</p>}</section>
	</div>
}

function Solicitudes() {
	const { user } = useAuth()
	const toast = useToast()
	const [requests, setRequests] = useState([])
	const [page, setPage] = useState(0)
	const [hasMore, setHasMore] = useState(false)
	const [history, setHistory] = useState({})
	const [proposals, setProposals] = useState({})
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [historyNotice, setHistoryNotice] = useState('')
	const [closingId, setClosingId] = useState('')
	const [confirmId, setConfirmId] = useState('')
	const [expanded, setExpanded] = useState(() => new Set())
	const [filtersOpen, setFiltersOpen] = useState(false)
	const [view, setView] = useViewMode('cliente-solicitudes', VIEWS.map((item) => item.value), 'compacta')
	const [filters, setFilters] = useState(emptyFilters)
	const effectiveFilters = useDebouncedValue(filters)

	useEffect(() => {
		let active = true
		async function loadRequests() {
			setLoading(true); setError(''); setHistoryNotice('')
			try {
				const { items: data, hasMore } = await obtenerSolicitudesUsuario(user.id, page, effectiveFilters)
				if (!active) return
				setRequests(data); setHasMore(hasMore)
				const ids = data.map((item) => item.id)
				const [nextHistory, counts] = await Promise.allSettled([obtenerHistorialSolicitudes(ids), contarPropuestas(ids)])
				if (!active) return
				if (nextHistory.status === 'fulfilled') setHistory(nextHistory.value)
				else setHistoryNotice('No se pudo cargar el historial. Vuelve a intentarlo.')
				if (counts.status === 'fulfilled') setProposals(counts.value)
			} catch (loadError) { if (active) setError(`No se pudieron cargar tus solicitudes: ${publicError(loadError)}`) }
			finally { if (active) setLoading(false) }
		}
		if (user?.id) loadRequests()
		return () => { active = false }
	}, [user?.id, page, effectiveFilters])

	const extraFilters = [filters.status, filters.from, filters.to].filter(Boolean).length
	const hasFilters = Object.values(effectiveFilters).some(Boolean)
	function updateFilter(event) { setPage(0); setFilters((current) => ({ ...current, [event.target.name]: event.target.value })) }
	function clearFilters() { setPage(0); setFilters(emptyFilters) }
	function toggleExpanded(id) {
		setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
	}
	async function handleClose(requestId) {
		setError('')
		setClosingId(requestId)
		try {
			const updated = await cerrarSolicitud(requestId, user.id)
			setRequests((current) => current.map((item) => item.id === requestId ? { ...item, ...updated } : item))
			setConfirmId('')
			toast({ title: 'Solicitud cerrada', tone: 'success' })
			try {
				const events = await obtenerHistorialSolicitud(requestId)
				setHistory((current) => ({ ...current, [requestId]: events }))
			} catch {
				setHistoryNotice('La solicitud se cerró, pero no se pudo actualizar el historial.')
			}
		} catch (closeError) { setError(`No se pudo cerrar la solicitud: ${publicError(closeError)}`) }
		finally { setClosingId('') }
	}

	return <section className="requests-page requests-page-compact">
		<div className="requests-heading"><div><p className="requests-eyebrow">Panel de cliente / Solicitudes</p><h1>Mis solicitudes</h1></div><Link className="button requests-button" to="/cliente/solicitudes/crear"><Icon name="plus" size={18} /> Nueva</Link></div>

		<div className="list-toolbar">
			<label className="list-search"><Icon name="search" size={18} /><input name="search" type="search" value={filters.search} onChange={updateFilter} placeholder="Buscar solicitudes" aria-label="Buscar por título, vehículo o categoría" /></label>
			<button type="button" className={`icon-action list-filter-toggle${filtersOpen ? ' is-on' : ''}`} aria-expanded={filtersOpen} aria-controls="request-filters" aria-label="Filtros" title="Filtros" onClick={() => setFiltersOpen((value) => !value)}>
				<Icon name="filter" size={18} />{extraFilters > 0 && <span className="icon-badge">{extraFilters}</span>}
			</button>
			<ViewSwitcher value={view} onChange={setView} options={VIEWS} />
		</div>
		<div id="request-filters" className="list-filters" hidden={!filtersOpen}>
			<label>Estado<Select ariaLabel="Estado" name="status" value={filters.status} onChange={updateFilter} options={[{ value: '', label: 'Todos' }, ...statuses.map((status) => ({ value: status, label: statusLabel(status) }))]} /></label>
			<label>Desde<input name="from" type="date" value={filters.from} onChange={updateFilter} /></label>
			<label>Hasta<input name="to" type="date" value={filters.to} onChange={updateFilter} /></label>
			<button className="filter-clear" type="button" onClick={clearFilters}>Limpiar</button>
		</div>

		{historyNotice && <p className="request-history-notice" role="status">{historyNotice}</p>}
		{loading && <SkeletonList label="Cargando tus solicitudes…" />}
		{error && <p className="request-error" role="alert">{error}</p>}
		{!loading && !error && requests.length === 0 && !hasFilters && <div className="request-empty"><h2>Aún no tienes solicitudes</h2><p>Crea una solicitud para encontrar el repuesto que necesitas.</p><Link className="button requests-button" to="/cliente/solicitudes/crear">Crear solicitud</Link></div>}
		{!loading && !error && hasFilters && requests.length === 0 && <div className="request-empty"><h2>No hay coincidencias</h2><p>Ajusta o limpia los filtros para ver tus solicitudes.</p><button className="button requests-button" type="button" onClick={clearFilters}>Limpiar filtros</button></div>}
		{!loading && !error && requests.length > 0 && <div className={`request-list request-list-${view}`}>{requests.map((request) => {
			const isOpen = view === 'detallada' || expanded.has(request.id)
			const summary = [request.categoriaNombre || 'Sin categoría', vehicleLabel(request.vehiculo)].join(' · ')
			return <article className={`request-card${isOpen ? ' is-expanded' : ''}`} key={request.id}>
				<button type="button" className="request-card-summary" aria-expanded={isOpen} onClick={() => view !== 'detallada' && toggleExpanded(request.id)} disabled={view === 'detallada'}>
					<span className="request-card-title"><strong className="request-card-name">{request.titulo}</strong>{view !== 'lista' && <span className="request-card-sub">{summary}</span>}</span>
					<span className={`request-status status-${request.estado}`}>{statusLabel(request.estado)}</span>
					{view === 'lista' && <time className="request-card-date" dateTime={request.fecha_creacion}>{shortDate(request.fecha_creacion)}</time>}
					{view !== 'detallada' && <span className="request-card-chevron" aria-hidden="true"><Icon name="chevron" size={16} /></span>}
				</button>
				{isOpen && <RequestDetail request={request} history={history[request.id]} />}
				{(view !== 'lista' || isOpen) && <RequestActions request={request} proposals={proposals[request.id]} confirming={confirmId === request.id} closing={closingId === request.id}
					onAskClose={() => setConfirmId(request.id)} onCancelClose={() => setConfirmId('')} onClose={() => handleClose(request.id)} />}
			</article>
		})}</div>}
		<Pagination page={page} hasMore={hasMore} loading={loading} onChange={setPage} />
	</section>
}
export default Solicitudes
