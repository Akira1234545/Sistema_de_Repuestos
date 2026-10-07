import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import { cerrarSolicitud, obtenerHistorialSolicitud, obtenerSolicitudesUsuario } from '../../services/solicitudService.js'
import './Solicitudes.css'

const statuses = ['publicada', 'recibiendo_propuestas', 'propuesta_seleccionada', 'atendida', 'cerrada']
function formatDate(value) { return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function vehicleLabel(vehicle) { return vehicle ? [vehicle.marcaNombre, vehicle.modeloNombre, vehicle.anio].filter(Boolean).join(' ') : 'Vehículo no disponible' }

function Solicitudes() {
	const { user } = useAuth()
	const [requests, setRequests] = useState([])
	const [history, setHistory] = useState({})
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [historyNotice, setHistoryNotice] = useState('')
	const [closingId, setClosingId] = useState('')
	const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '' })

	useEffect(() => {
		let active = true
		async function loadRequests() {
			setLoading(true)
			try {
				const data = await obtenerSolicitudesUsuario(user.id)
				if (!active) return
				setRequests(data)
				const results = await Promise.all(data.map(async (request) => ({ id: request.id, result: await obtenerHistorialSolicitud(request.id).then((value) => ({ value })).catch((cause) => ({ cause })) })))
				if (!active) return
				const next = {}
				for (const { id, result } of results) {
					if (result.cause) setHistoryNotice('Aplica database/migrations/20261006_solicitud_historial.sql para activar el historial. Las solicitudes existentes no tienen eventos retroactivos.')
					else next[id] = result.value
				}
				setHistory(next)
			} catch (loadError) { if (active) setError(`No se pudieron cargar tus solicitudes: ${loadError.message}`) }
			finally { if (active) setLoading(false) }
		}
		if (user?.id) loadRequests()
		return () => { active = false }
	}, [user?.id])

	const filtered = useMemo(() => requests.filter((request) => {
		const term = filters.search.trim().toLocaleLowerCase()
		const created = request.fecha_creacion?.slice(0, 10)
		return (!term || [request.titulo, request.descripcion, request.categoriaNombre, vehicleLabel(request.vehiculo)].some((value) => value?.toLocaleLowerCase().includes(term)))
			&& (!filters.status || filters.status === request.estado)
			&& (!filters.from || created >= filters.from) && (!filters.to || created <= filters.to)
	}), [requests, filters])
	function updateFilter(event) { setFilters((current) => ({ ...current, [event.target.name]: event.target.value })) }
	function clearFilters() { setFilters({ search: '', status: '', from: '', to: '' }) }
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
				setHistoryNotice('La solicitud se cerró, pero no se pudo actualizar el timeline. Verifica que ambas migraciones Sprint 1 estén aplicadas.')
			}
		} catch (closeError) { setError(`No se pudo cerrar la solicitud: ${closeError.message}`) }
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
		{!loading && !error && requests.length === 0 && <div className="request-empty"><h2>Aún no tienes solicitudes</h2><p>Crea una solicitud para encontrar el repuesto que necesitas.</p><Link className="button requests-button" to="/cliente/solicitudes/crear">Crear solicitud</Link></div>}
		{!loading && !error && requests.length > 0 && filtered.length === 0 && <div className="request-empty"><h2>No hay coincidencias</h2><p>Ajusta o limpia los filtros para ver tus solicitudes.</p><button className="button requests-button" type="button" onClick={clearFilters}>Limpiar filtros</button></div>}
		{!loading && !error && filtered.length > 0 && <div className="request-list">{filtered.map((request, index) => <article className="request-card" key={request.id}>
			<div className="request-card-top"><div><span className="request-number">SOLICITUD {String(index + 1).padStart(2, '0')}</span><h2>{request.titulo}</h2></div><span className="request-status">{request.estado.replaceAll('_', ' ')}</span></div>
			<div className="request-meta"><span><strong>Vehículo:</strong> {vehicleLabel(request.vehiculo)}</span><span><strong>Categoría:</strong> {request.categoriaNombre || 'Sin categoría'}</span><span><strong>Cantidad:</strong> {request.cantidad}</span><span><strong>Creada:</strong> {formatDate(request.fecha_creacion)}</span></div>
			{request.descripcion && <p className="request-description">{request.descripcion}</p>}
			<section className="request-timeline" aria-label={`Historial de ${request.titulo}`}><h3>Historial de estado</h3>{history[request.id]?.length ? <ol>{history[request.id].map((event) => <li key={event.id}><span>{event.estado_anterior ? `${event.estado_anterior.replaceAll('_', ' ')} → ` : ''}{event.estado_nuevo.replaceAll('_', ' ')}</span><time dateTime={event.fecha}>{formatDate(event.fecha)}</time></li>)}</ol> : <p>Sin cambios de estado registrados.</p>}</section>
			<div className="request-card-footer">{['publicada', 'recibiendo_propuestas'].includes(request.estado) && <><Link className="request-edit" to={`/cliente/solicitudes/editar/${request.id}`}>Editar solicitud ↗</Link><button className="request-close" type="button" onClick={() => handleClose(request.id)} disabled={closingId === request.id}>{closingId === request.id ? 'Cerrando…' : 'Cerrar solicitud'}</button></>}</div>
		</article>)}</div>}
	</section>
}
export default Solicitudes
