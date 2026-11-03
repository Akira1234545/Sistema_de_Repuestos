import { publicError } from '../../lib/errors.js'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js'
import Pagination from '../../components/Pagination.jsx'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import FavoriteToggle from '../../components/FavoriteToggle.jsx'
import { cerrarSolicitud, obtenerHistorialSolicitud, obtenerHistorialSolicitudes, obtenerSolicitudesUsuario } from '../../services/solicitudService.js'
import './Solicitudes.css'

const statuses = ['publicada', 'recibiendo_propuestas', 'propuesta_seleccionada', 'atendida', 'cerrada']
function formatDate(value) { return new Intl.DateTimeFormat('es', { timeZone: 'America/La_Paz', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function vehicleLabel(vehicle) { return vehicle ? [vehicle.marcaNombre, vehicle.modeloNombre, vehicle.anio].filter(Boolean).join(' ') : 'Vehículo no disponible' }

function Solicitudes() {
	const { user } = useAuth()
	const [requests, setRequests] = useState([])
	const [page, setPage] = useState(0)
	const [hasMore, setHasMore] = useState(false)
	const [history, setHistory] = useState({})
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [historyNotice, setHistoryNotice] = useState('')
	const [closingId, setClosingId] = useState('')
	const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '' })
	const effectiveFilters = useDebouncedValue(filters)

	useEffect(() => {
		let active = true
		async function loadRequests() {
			setLoading(true); setError(''); setHistoryNotice('')
			try {
				const { items: data, hasMore } = await obtenerSolicitudesUsuario(user.id, page, effectiveFilters)
				if (!active) return
				setRequests(data); setHasMore(hasMore)
				try {
                    const next = await obtenerHistorialSolicitudes(data.map(item => item.id))
                    if (active) setHistory(next)
                } catch { if (active) setHistoryNotice('No se pudo cargar el historial. Vuelve a intentarlo.') }
			} catch (loadError) { if (active) setError(`No se pudieron cargar tus solicitudes: ${publicError(loadError)}`) }
			finally { if (active) setLoading(false) }
		}
		if (user?.id) loadRequests()
		return () => { active = false }
	}, [user?.id, page, effectiveFilters])

	const filtered = requests
	const hasFilters = Object.values(effectiveFilters).some(Boolean)
	function updateFilter(event) { setPage(0); setFilters((current) => ({ ...current, [event.target.name]: event.target.value })) }
	function clearFilters() { setPage(0); setFilters({ search: '', status: '', from: '', to: '' }) }
	async function handleClose(requestId) {
		setError('')
		setClosingId(requestId)
		try {
			const updated = await cerrarSolicitud(requestId, user.id)
			setRequests((current) => current.map((item) => item.id === requestId ? { ...item, ...updated } : item))
			try {
				const events = await obtenerHistorialSolicitud(requestId)
				setHistory((current) => ({ ...current, [requestId]: events }))
			} catch {
				setHistoryNotice('La solicitud se cerró, pero no se pudo actualizar el historial. Revisa sus permisos de lectura en Supabase.')
			}
		} catch (closeError) { setError(`No se pudo cerrar la solicitud: ${publicError(closeError)}`) }
		finally { setClosingId('') }
	}

	return <section className="requests-page">
		<div className="requests-heading"><div><p className="requests-eyebrow">Panel de cliente / Solicitudes</p><h1>Mis solicitudes</h1><p className="requests-lead">Revisa lo que necesitas y sigue el estado de cada búsqueda.</p></div><Link className="button requests-button" to="/cliente/solicitudes/crear">+ Nueva solicitud</Link></div>
		<div className="requests-divider" />
		<div className="request-filters">
			<label>Buscar<input name="search" value={filters.search} onChange={updateFilter} placeholder="Título, vehículo o categoría" /></label>
			<label>Estado<select name="status" value={filters.status} onChange={updateFilter}><option value="">Todos</option>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
			<label>Desde<input name="from" type="date" value={filters.from} onChange={updateFilter} /></label><label>Hasta<input name="to" type="date" value={filters.to} onChange={updateFilter} /></label>
			<button className="filter-clear" type="button" onClick={clearFilters}>Limpiar filtros</button>
		</div>
		{historyNotice && <p className="request-history-notice" role="status">{historyNotice}</p>}
		{loading && <p className="request-loading">Cargando tus solicitudes...</p>}
		{error && <p className="request-error" role="alert">{error}</p>}
		{!loading && !error && requests.length === 0 && !hasFilters && <div className="request-empty"><h2>Aún no tienes solicitudes</h2><p>Crea una solicitud para encontrar el repuesto que necesitas.</p><Link className="button requests-button" to="/cliente/solicitudes/crear">Crear solicitud</Link></div>}
		{!loading && !error && hasFilters && filtered.length === 0 && <div className="request-empty"><h2>No hay coincidencias</h2><p>Ajusta o limpia los filtros para ver tus solicitudes.</p><button className="button requests-button" type="button" onClick={clearFilters}>Limpiar filtros</button></div>}
		{!loading && !error && filtered.length > 0 && <div className="request-list">{filtered.map((request, index) => <article className="request-card" key={request.id}>
			<div className="request-card-top"><div><span className="request-number">SOLICITUD {String(page * 25 + index + 1).padStart(2, '0')}</span><h2>{request.titulo}</h2></div><span className="request-status">{request.estado.replaceAll('_', ' ')}</span></div>
			<div className="request-meta"><span><strong>Vehículo:</strong> {vehicleLabel(request.vehiculo)}</span><span><strong>Categoría:</strong> {request.categoriaNombre || 'Sin categoría'}</span><span><strong>Cantidad:</strong> {request.cantidad}</span><span><strong>Creada:</strong> {formatDate(request.fecha_creacion)}</span></div>
			{request.descripcion && <p className="request-description">{request.descripcion}</p>}
			<section className="request-timeline" aria-label={`Historial de ${request.titulo}`}><h3>Historial de estado</h3>{history[request.id]?.length ? <ol>{history[request.id].map((event) => <li key={event.id}><span>{event.estado_anterior ? `${event.estado_anterior.replaceAll('_', ' ')} → ` : ''}{event.estado_nuevo.replaceAll('_', ' ')}</span><time dateTime={event.fecha}>{formatDate(event.fecha)}</time></li>)}</ol> : <p>Sin cambios de estado registrados.</p>}</section>
			<div className="request-card-footer"><FavoriteToggle type="solicitud" itemId={request.id} label="solicitud" /><Link className="request-proposals-link" to={`/cliente/solicitudes/${request.id}/propuestas`}>Ver propuestas</Link>{['publicada', 'recibiendo_propuestas'].includes(request.estado) && <><Link className="request-edit" to={`/cliente/solicitudes/editar/${request.id}`}>Editar solicitud ↗</Link><button className="request-close" type="button" onClick={() => handleClose(request.id)} disabled={closingId === request.id}>{closingId === request.id ? 'Cerrando…' : 'Cerrar solicitud'}</button></>}</div>
		</article>)}</div>}
		<Pagination page={page} hasMore={hasMore} loading={loading} onChange={setPage} />
	</section>
}
export default Solicitudes
