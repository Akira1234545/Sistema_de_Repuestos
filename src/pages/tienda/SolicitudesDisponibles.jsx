import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import FavoriteToggle from '../../components/FavoriteToggle.jsx'
import { obtenerCategoriasActivas, obtenerSolicitudesDisponibles } from '../../services/solicitudService.js'
import { obtenerTiendaUsuario } from '../../services/tiendaService.js'
import './SolicitudesTienda.css'

function formatDate(value) { return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value)) }
function vehicleLabel(vehicle) { return vehicle ? [vehicle.tipoNombre, vehicle.marcaNombre, vehicle.modeloNombre, vehicle.anio].filter(Boolean).join(' ') : 'Vehículo no disponible' }

function SolicitudesDisponibles() {
	const { user } = useAuth()
	const [requests, setRequests] = useState([])
	const [store, setStore] = useState(null)
	const [categories, setCategories] = useState([])
	const [filters, setFilters] = useState({ category: '', status: '', search: '', from: '', to: '' })
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	useEffect(() => {
		let active = true
		Promise.allSettled([obtenerSolicitudesDisponibles(), obtenerCategoriasActivas(), obtenerTiendaUsuario(user.id)]).then(([result, cats, ownStore]) => {
			if (!active) return
			if (result.status === 'rejected') setError(`No se pudieron cargar las solicitudes disponibles: ${result.reason.message}`)
			else setRequests(result.value)
			if (cats.status === 'fulfilled') setCategories(cats.value)
			if (ownStore.status === 'fulfilled') setStore(ownStore.value)
		}).finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [user.id])
	const filtered = useMemo(() => requests.filter((request) => {
		const term = filters.search.trim().toLocaleLowerCase()
		const searchable = [request.titulo, request.descripcion, request.categoriaNombre, vehicleLabel(request.vehiculo)].join(' ').toLocaleLowerCase()
		const date = request.fecha_creacion?.slice(0, 10)
		return (!filters.category || request.categoria_id === filters.category) && (!filters.status || request.estado === filters.status)
			&& (!term || searchable.includes(term)) && (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to)
	}), [requests, filters])
	function update(event) { setFilters((current) => ({ ...current, [event.target.name]: event.target.value })) }
	function clearFilters() { setFilters({ category: '', status: '', search: '', from: '', to: '' }) }
	return <section className="store-requests-page"><div className="store-requests-heading"><div><p className="store-eyebrow">Panel de tienda / Oportunidades</p><h1>Solicitudes disponibles</h1><p className="store-requests-lead">Consulta las solicitudes publicadas por clientes y encuentra las que coinciden con lo que ofrece tu tienda.</p></div><span className="store-requests-count">{filtered.length} disponibles</span></div>
		{(!store || store.estado !== 'aprobada' || !store.activa) && <p className="store-request-message" role="status">{!store ? 'Completa el perfil de tu tienda y espera su aprobación para consultar solicitudes.' : `Tu tienda está ${store.estado}${store.activa ? '' : ' e inactiva'}. Solo tiendas activas y aprobadas pueden ver solicitudes que coincidan con sus categorías.`}</p>}
		<div className="store-filters"><label className="store-filter">Buscar<input name="search" value={filters.search} onChange={update} placeholder="Título, vehículo o descripción" /></label><label className="store-filter">Categoría<select name="category" value={filters.category} onChange={update}><option value="">Todas las categorías</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="store-filter">Estado<select name="status" value={filters.status} onChange={update}><option value="">Todos los estados</option><option value="publicada">Publicada</option><option value="recibiendo_propuestas">Recibiendo propuestas</option></select></label><label className="store-filter">Desde<input name="from" type="date" value={filters.from} onChange={update} /></label><label className="store-filter">Hasta<input name="to" type="date" value={filters.to} onChange={update} /></label><button className="filter-clear" type="button" onClick={clearFilters}>Limpiar filtros</button></div>
		{loading && <p className="store-request-message">Cargando solicitudes disponibles...</p>}{error && <p className="store-request-error" role="alert">{error}</p>}{!loading && !error && filtered.length === 0 && <div className="store-request-empty">{requests.length ? 'No hay coincidencias. Ajusta los filtros o límpialos.' : 'No hay solicitudes disponibles.'}{requests.length > 0 && <button className="filter-clear" type="button" onClick={clearFilters}>Limpiar filtros</button>}</div>}
		{!loading && !error && filtered.length > 0 && <div className="store-request-list">{filtered.map((request, index) => <article className="store-request-card" key={request.id}><div className="store-request-top"><div><span className="store-request-number">SOLICITUD {String(index + 1).padStart(2, '0')}</span><h2>{request.titulo}</h2></div><span className="store-request-status">{request.estado.replaceAll('_', ' ')}</span></div><p className="store-request-description">{request.descripcion}</p><div className="store-request-meta"><span><strong>Categoría:</strong> {request.categoriaNombre || 'No disponible'}</span><span><strong>Vehículo:</strong> {vehicleLabel(request.vehiculo)}</span><span><strong>Cantidad:</strong> {request.cantidad}</span></div><div className="store-request-footer"><span className="store-request-date">Publicado: {formatDate(request.fecha_creacion)}</span><span className="store-request-links"><FavoriteToggle type="solicitud" itemId={request.id} label="solicitud" /><Link className="store-request-link" to={`/tienda/solicitudes/${request.id}`}>Ver solicitud ↗</Link></span></div></article>)}</div>}
	</section>
}
export default SolicitudesDisponibles
