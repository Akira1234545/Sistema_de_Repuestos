import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { obtenerSolicitudDisponiblePorId } from '../../services/solicitudService.js'
import './SolicitudesTienda.css'

function formatDate(value) {
	return new Intl.DateTimeFormat('es', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
}

function DetalleSolicitud() {
	const { id } = useParams()
	const [request, setRequest] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		obtenerSolicitudDisponiblePorId(id).then((data) => { if (active) setRequest(data) }).catch((loadError) => { if (active) setError(`No se pudo cargar la solicitud: ${loadError.message}`) }).finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [id])

	if (loading) return <section className="store-requests-page"><p className="store-request-message">Cargando detalle...</p></section>
	if (error) return <section className="store-requests-page"><p className="store-request-error" role="alert">{error}</p></section>
	if (!request) return <section className="store-requests-page"><p className="store-request-empty">Esta solicitud ya no está disponible.</p><Link className="store-request-detail-back" to="/tienda/solicitudes">Volver a solicitudes ↩</Link></section>

	const vehicle = request.vehiculo
	return <section className="store-requests-page store-request-detail"><div className="store-request-detail-header"><div><p className="store-eyebrow">Panel de tienda / Solicitud</p><h1>{request.titulo}</h1></div><Link className="store-request-detail-back" to="/tienda/solicitudes">← Volver a solicitudes</Link></div><div className="store-request-detail-card"><div className="store-detail-section"><p className="store-detail-label">Estado y publicación</p><div className="store-detail-grid"><div><span>Estado</span><strong>{request.estado}</strong></div><div><span>Categoría</span><strong>{request.categoriaNombre || 'No disponible'}</strong></div><div><span>Cantidad</span><strong>{request.cantidad}</strong></div><div><span>Publicado</span><strong>{formatDate(request.fecha_creacion)}</strong></div></div></div><div className="store-detail-section"><p className="store-detail-label">Descripción</p><p>{request.descripcion}</p></div>{request.caracteristicas && <div className="store-detail-section"><p className="store-detail-label">Características</p><p>{request.caracteristicas}</p></div>}<div className="store-detail-section"><p className="store-detail-label">Vehículo</p><div className="store-detail-grid"><div><span>Tipo</span><strong>{vehicle?.tipoNombre || 'No disponible'}</strong></div><div><span>Marca</span><strong>{vehicle?.marcaNombre || 'No disponible'}</strong></div><div><span>Modelo</span><strong>{vehicle?.modeloNombre || 'No disponible'}</strong></div><div><span>Año</span><strong>{vehicle?.anio || 'No disponible'}</strong></div></div></div></div></section>
}

export default DetalleSolicitud
