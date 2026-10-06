import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { obtenerSolicitudesUsuario } from '../../services/solicitudService.js'
import './Solicitudes.css'

function formatDate(value) {
	return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))
}

function vehicleLabel(vehicle) {
	if (!vehicle) return 'Vehículo no disponible'
	return [vehicle.marcaNombre, vehicle.modeloNombre, vehicle.anio].filter(Boolean).join(' ')
}

function Solicitudes() {
	const { user } = useAuth()
	const [requests, setRequests] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true

		async function loadRequests() {
			setLoading(true)
			setError('')
			try {
				const data = await obtenerSolicitudesUsuario(user.id)
				if (active) setRequests(data)
			} catch (requestError) {
				if (active) setError(`No se pudieron cargar tus solicitudes: ${requestError.message}`)
			} finally {
				if (active) setLoading(false)
			}
		}

		if (user?.id) loadRequests()
		return () => { active = false }
	}, [user?.id])

	return (
		<section className="requests-page">
			<div className="requests-heading"><div><p className="requests-eyebrow">Panel de cliente / Solicitudes</p><h1>Mis solicitudes</h1><p className="requests-lead">Revisa lo que necesitas y sigue el estado de cada búsqueda.</p></div><Link className="button requests-button" to="/cliente/solicitudes/crear">+ Nueva solicitud</Link></div>
			<div className="requests-divider" />
			{loading && <p className="request-loading">Cargando tus solicitudes...</p>}
			{error && <p className="request-error" role="alert">{error}</p>}
			{!loading && !error && requests.length === 0 && <div className="request-empty"><h2>Aún no tienes solicitudes</h2><p>Crea una solicitud para encontrar el repuesto que necesitas.</p><Link className="button requests-button" to="/cliente/solicitudes/crear">Crear solicitud</Link></div>}
			{!loading && !error && requests.length > 0 && <div className="request-list">{requests.map((request, index) => <article className="request-card" key={request.id}><div className="request-card-top"><div><span className="request-number">SOLICITUD 0{index + 1}</span><h2>{request.titulo}</h2></div><span className="request-status">{request.estado}</span></div><div className="request-meta"><span><strong>Vehículo:</strong> {vehicleLabel(request.vehiculo)}</span><span><strong>Categoría:</strong> {request.categoriaNombre || 'Sin categoría'}</span><span><strong>Cantidad:</strong> {request.cantidad}</span><span><strong>Creada:</strong> {formatDate(request.fecha_creacion)}</span></div>{request.descripcion && <p className="request-description">{request.descripcion}</p>}<div className="request-card-footer"><Link className="request-edit" to={`/cliente/solicitudes/editar/${request.id}`}>Editar solicitud ↗</Link></div></article>)}</div>}
		</section>
	)
}

export default Solicitudes
