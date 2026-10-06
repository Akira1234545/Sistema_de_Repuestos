import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { obtenerSolicitudPorId, actualizarSolicitud } from '../../services/solicitudService.js'
import { SolicitudForm } from './CrearSolicitud.jsx'
import './Solicitudes.css'

function EditarSolicitud() {
	const { id } = useParams()
	const { user } = useAuth()
	const navigate = useNavigate()
	const [request, setRequest] = useState(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true

		async function loadRequest() {
			try {
				const data = await obtenerSolicitudPorId(id, user.id)
				if (!data) {
					setError('La solicitud no existe o no pertenece al usuario autenticado.')
				} else if (active) {
					setRequest(data)
				}
			} catch (loadError) {
				if (active) setError(`No se pudo cargar la solicitud: ${loadError.message}`)
			} finally {
				if (active) setLoading(false)
			}
		}

		if (user?.id && id) loadRequest()
		return () => { active = false }
	}, [id, user?.id])

	async function handleSubmit(values, validationError) {
		if (validationError) { setError(validationError); return }
		setError('')
		setSaving(true)
		try {
			await actualizarSolicitud(id, user.id, values)
			navigate('/cliente/solicitudes')
		} catch (saveError) {
			setError(`No se pudo actualizar la solicitud: ${saveError.message}`)
		} finally {
			setSaving(false)
		}
	}

	if (loading) return <section className="requests-page"><p className="request-loading">Cargando solicitud...</p></section>
	if (!request) return <section className="requests-page"><p className="request-error" role="alert">{error}</p></section>

	return <section className="requests-page"><div className="request-form"><div className="request-form-header"><p className="requests-eyebrow">Panel de cliente / Editar solicitud</p><h1>Actualiza tu solicitud</h1><p className="request-form-lead">Puedes ajustar los detalles mientras la solicitud siga en tu espacio.</p></div><SolicitudForm editingId={id} initialValues={{ userId: user.id, vehiculo_id: request.vehiculo_id, categoria_id: request.categoria_id, titulo: request.titulo, descripcion: request.descripcion, caracteristicas: request.caracteristicas || '', cantidad: String(request.cantidad) }} onSubmit={handleSubmit} saving={saving} error={error} /></div></section>
}

export default EditarSolicitud
