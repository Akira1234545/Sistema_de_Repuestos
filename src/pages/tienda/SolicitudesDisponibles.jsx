import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { obtenerCategoriasActivas, obtenerSolicitudesDisponibles } from '../../services/solicitudService.js'
import './SolicitudesTienda.css'

function formatDate(value) {
	return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))
}

function vehicleLabel(vehicle) {
	if (!vehicle) return 'Vehículo no disponible'
	return [vehicle.tipoNombre, vehicle.marcaNombre, vehicle.modeloNombre, vehicle.anio].filter(Boolean).join(' ')
}

function SolicitudesDisponibles() {
	const [requests, setRequests] = useState([])
	const [categories, setCategories] = useState([])
	const [category, setCategory] = useState('')
	const [status, setStatus] = useState('')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		Promise.allSettled([obtenerSolicitudesDisponibles(), obtenerCategoriasActivas()])
			.then(([requestsResult, categoriesResult]) => {
				if (!active) return
				if (requestsResult.status === 'rejected') {
					setError(`No se pudieron cargar las solicitudes disponibles: ${requestsResult.reason.message}`)
					return
				}
				console.log('=== DEBUG COMPONENTE SOLICITUDES ===')
				console.log('DATOS RECIBIDOS POR COMPONENTE:', requestsResult.value)
				console.log('CANTIDAD EN COMPONENTE:', requestsResult.value?.length)
				setRequests(requestsResult.value)
				if (categoriesResult.status === 'fulfilled') setCategories(categoriesResult.value)
			})
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [])

	const filteredRequests = useMemo(() => {
		return requests.filter((request) => {
			const matchesCategory = !category || request.categoria_id === category
			const matchesStatus = !status || request.estado === status
			return matchesCategory && matchesStatus
		})
	}, [requests, category, status])

	return <section className="store-requests-page"><div className="store-requests-heading"><div><p className="store-eyebrow">Panel de tienda / Oportunidades</p><h1>Solicitudes disponibles</h1><p className="store-requests-lead">Consulta las solicitudes publicadas por clientes y encuentra las que coinciden con lo que ofrece tu tienda.</p></div><span className="store-requests-count">{filteredRequests.length} disponibles</span></div><div className="store-filters"><label className="store-filter">Categoría<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas las categorías</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label><label className="store-filter">Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option><option value="publicada">Publicada</option><option value="recibiendo_propuestas">Recibiendo propuestas</option></select></label></div>{loading && <p className="store-request-message">Cargando solicitudes disponibles...</p>}{error && <p className="store-request-error" role="alert">{error}</p>}{!loading && !error && filteredRequests.length === 0 && <p className="store-request-empty">No hay solicitudes disponibles.</p>}{!loading && !error && filteredRequests.length > 0 && <div className="store-request-list">{filteredRequests.map((request, index) => <article className="store-request-card" key={request.id}><div className="store-request-top"><div><span className="store-request-number">SOLICITUD 0{index + 1}</span><h2>{request.titulo}</h2></div><span className="store-request-status">{request.estado}</span></div><p className="store-request-description">{request.descripcion}</p><div className="store-request-meta"><span><strong>Categoría:</strong> {request.categoriaNombre || 'No disponible'}</span><span><strong>Vehículo:</strong> {vehicleLabel(request.vehiculo)}</span><span><strong>Cantidad:</strong> {request.cantidad}</span></div><div className="store-request-footer"><span className="store-request-date">Publicado: {formatDate(request.fecha_creacion)}</span><Link className="store-request-link" to={`/tienda/solicitudes/${request.id}`}>Ver solicitud ↗</Link></div></article>)}</div>}</section>
}

export default SolicitudesDisponibles
