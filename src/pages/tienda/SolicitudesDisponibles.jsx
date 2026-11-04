import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import { useViewMode } from '../../hooks/useViewMode.js'
import SkeletonList from '../../components/ui/Skeleton.jsx'
import { publicError } from '../../lib/errors.js'
import Pagination from '../../components/Pagination.jsx'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import FavoriteToggle from '../../components/FavoriteToggle.jsx'
import Icon from '../../components/Icon.jsx'
import ViewSwitcher from '../../components/ui/ViewSwitcher.jsx'
import { obtenerCategoriasActivas, obtenerSolicitudesDisponibles } from '../../services/solicitudService.js'
import { obtenerTiendaUsuario } from '../../services/tiendaService.js'
import { statusLabel } from '../../lib/format.js'
import Select from '../../components/ui/Select.jsx'

const VIEWS = [
	{ value: 'compacta', label: 'Vista compacta', icon: 'compact' },
	{ value: 'lista', label: 'Solo listado', icon: 'list' },
	{ value: 'detallada', label: 'Vista detallada', icon: 'detail' },
]
const emptyFilters = { category: '', status: '', search: '', from: '', to: '' }
function formatDate(value) { return new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', dateStyle: 'medium' }).format(new Date(value)) }
function shortDate(value) { return new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', day: 'numeric', month: 'short' }).format(new Date(value)) }
function vehicleLabel(vehicle) { return vehicle ? [vehicle.marcaNombre, vehicle.modeloNombre, vehicle.anio].filter(Boolean).join(' ') : 'Vehículo no disponible' }

function SolicitudesDisponibles() {
	const { user } = useAuth()
	const [requests, setRequests] = useState([])
	const [page, setPage] = useState(0)
	const [hasMore, setHasMore] = useState(false)
	const [store, setStore] = useState(null)
	const [categories, setCategories] = useState([])
	const [filters, setFilters] = useState(emptyFilters)
	const [filtersOpen, setFiltersOpen] = useState(false)
	const [expanded, setExpanded] = useState(() => new Set())
	const [view, setView] = useViewMode('tienda-solicitudes', VIEWS.map((item) => item.value), 'compacta')
	const effectiveFilters = useDebouncedValue(filters)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	useEffect(() => {
		let active = true
		Promise.resolve().then(() => { if (active) { setLoading(true); setError('') }; return Promise.allSettled([obtenerSolicitudesDisponibles(page, effectiveFilters), obtenerCategoriasActivas(), obtenerTiendaUsuario(user.id)]) }).then(([result, cats, ownStore]) => {
			if (!active) return
			if (result.status === 'rejected') setError(`No se pudieron cargar las solicitudes disponibles: ${publicError(result.reason)}`)
			else { setRequests(result.value.items); setHasMore(result.value.hasMore) }
			if (cats.status === 'fulfilled') setCategories(cats.value)
			if (ownStore.status === 'fulfilled') setStore(ownStore.value)
		}).finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [user.id, page, effectiveFilters])
	const extraFilters = [filters.category, filters.status, filters.from, filters.to].filter(Boolean).length
	const hasFilters = Object.values(effectiveFilters).some(Boolean)
	function update(event) { setPage(0); setFilters((current) => ({ ...current, [event.target.name]: event.target.value })) }
	function clearFilters() { setPage(0); setFilters(emptyFilters) }
	function toggleExpanded(id) { setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next }) }

	return <section className="store-requests-page requests-page-compact">
		<div className="requests-heading"><div><p className="store-eyebrow">Panel de tienda / Oportunidades</p><h1>Solicitudes disponibles</h1></div></div>
		{(!store || store.estado !== 'aprobada' || !store.activa) && !loading && <p className="store-request-message" role="status">{!store ? 'Completa el perfil de tu tienda y espera su aprobación para consultar solicitudes.' : `Tu tienda está ${statusLabel(store.estado).toLowerCase()}${store.activa ? '' : ' e inactiva'}. Solo las tiendas activas y aprobadas ven las solicitudes de sus categorías.`}</p>}

		<div className="list-toolbar">
			<label className="list-search"><Icon name="search" size={18} /><input name="search" type="search" value={filters.search} onChange={update} placeholder="Buscar solicitudes" aria-label="Buscar por título, vehículo o descripción" /></label>
			<button type="button" className={`icon-action list-filter-toggle${filtersOpen ? ' is-on' : ''}`} aria-expanded={filtersOpen} aria-controls="store-request-filters" aria-label="Filtros" title="Filtros" onClick={() => setFiltersOpen((value) => !value)}>
				<Icon name="filter" size={18} />{extraFilters > 0 && <span className="icon-badge">{extraFilters}</span>}
			</button>
			<ViewSwitcher value={view} onChange={setView} options={VIEWS} />
		</div>
		<div id="store-request-filters" className="list-filters" hidden={!filtersOpen}>
			<label>Categoría<Select ariaLabel="Categoría" name="category" value={filters.category} onChange={update} options={[{ value: '', label: 'Todas las categorías' }, ...categories.map((item) => ({ value: item.id, label: item.nombre }))]} /></label>
			<label>Estado<Select ariaLabel="Estado" name="status" value={filters.status} onChange={update} options={[{ value: '', label: 'Todos los estados' }, { value: 'publicada', label: 'Publicada' }, { value: 'recibiendo_propuestas', label: 'Recibiendo propuestas' }]} /></label>
			<label>Desde<input name="from" type="date" value={filters.from} onChange={update} /></label>
			<label>Hasta<input name="to" type="date" value={filters.to} onChange={update} /></label>
			<button className="filter-clear" type="button" onClick={clearFilters}>Limpiar</button>
		</div>

		{loading && <SkeletonList label="Cargando solicitudes disponibles…" />}
		{error && <p className="store-request-error" role="alert">{error}</p>}
		{!loading && !error && requests.length === 0 && <div className="store-request-empty">{hasFilters ? 'No hay coincidencias. Ajusta los filtros o límpialos.' : 'No hay solicitudes disponibles por ahora.'}{hasFilters && <button className="filter-clear" type="button" onClick={clearFilters}>Limpiar filtros</button>}</div>}
		{!loading && !error && requests.length > 0 && <div className={`request-list request-list-${view}`}>{requests.map((request) => {
			const isOpen = view === 'detallada' || expanded.has(request.id)
			return <article className={`request-card${isOpen ? ' is-expanded' : ''}`} key={request.id}>
				<button type="button" className="request-card-summary" aria-expanded={isOpen} onClick={() => view !== 'detallada' && toggleExpanded(request.id)} disabled={view === 'detallada'}>
					<span className="request-card-title"><strong className="request-card-name">{request.titulo}</strong>{view !== 'lista' && <span className="request-card-sub">{[request.categoriaNombre || 'Sin categoría', vehicleLabel(request.vehiculo), `x${request.cantidad}`].join(' · ')}</span>}</span>
					<span className={`request-status status-${request.estado}`}>{statusLabel(request.estado)}</span>
					{view === 'lista' && <time className="request-card-date" dateTime={request.fecha_creacion}>{shortDate(request.fecha_creacion)}</time>}
					{view !== 'detallada' && <span className="request-card-chevron" aria-hidden="true"><Icon name="chevron" size={16} /></span>}
				</button>
				{isOpen && <div className="request-detail">
					<div className="request-meta"><span><strong>Vehículo:</strong> {[request.vehiculo?.tipoNombre, vehicleLabel(request.vehiculo)].filter(Boolean).join(' · ')}</span><span><strong>Categoría:</strong> {request.categoriaNombre || 'No disponible'}</span><span><strong>Cantidad:</strong> {request.cantidad}</span><span><strong>Publicada:</strong> {formatDate(request.fecha_creacion)}</span></div>
					{request.descripcion && <p className="request-description">{request.descripcion}</p>}
				</div>}
				{(view !== 'lista' || isOpen) && <div className="request-icon-actions">
					<FavoriteToggle type="solicitud" itemId={request.id} label="solicitud" iconOnly />
					<Link className="icon-action is-wide is-primary" to={`/tienda/solicitudes/${request.id}`}><Icon name="eye" size={18} /> Ver y proponer</Link>
				</div>}
			</article>
		})}</div>}
		<Pagination page={page} hasMore={hasMore} loading={loading} onChange={setPage} />
	</section>
}
export default SolicitudesDisponibles
