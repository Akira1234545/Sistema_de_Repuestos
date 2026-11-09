import { publicError } from '../../lib/errors.js'
import { useToast } from '../../context/toastState.js'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import { obtenerSolicitudPorId, actualizarSolicitud } from '../../services/solicitudService.js'
import { SolicitudForm } from './CrearSolicitud.jsx'
import { statusLabel } from '../../lib/format.js'

function EditarSolicitud() {
	const { id } = useParams()
	const { user } = useAuth()
	const navigate = useNavigate()
	const toast = useToast()
	const [request, setRequest] = useState(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true

		async function loadRequest() {
			try {
				const data = await obtenerSolicitudPorId(id, user.id)
				if (!active) return
				if (!data) {
					setError('La solicitud no existe o no pertenece al usuario autenticado.')
				} else {
					setRequest(data)
				}
			} catch (loadError) {
				if (active) setError(`No se pudo cargar la solicitud: ${publicError(loadError)}`)
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
			toast({ title: 'Solicitud actualizada', tone: 'success' })
			navigate('/cliente/solicitudes')
		} catch (saveError) {
			setError(`No se pudo actualizar la solicitud: ${publicError(saveError)}`)
		} finally {
			setSaving(false)
		}
	}

	if (loading) return <section className="requests-page"><p className="request-loading">Cargando solicitud...</p></section>
	if (!request) return <section className="requests-page"><p className="request-error" role="alert">{error}</p></section>
	if (request.estado !== 'publicada') return <section className="requests-page"><div className="request-empty"><h2>Esta solicitud ya no se puede editar</h2><p>Estado actual: {statusLabel(request.estado)}.</p><Link className="button requests-button" to="/cliente/solicitudes">Volver a mis solicitudes</Link></div></section>

	return <section className="requests-page"><div className="request-form"><div className="request-form-header"><p className="requests-eyebrow">Panel de cliente / Editar solicitud</p><h1>Actualiza tu solicitud</h1><p className="request-form-lead">Puedes ajustar los detalles mientras la solicitud siga en tu espacio.</p></div><SolicitudForm key={id} editingId={id} initialValues={{ userId: user.id, vehiculo_id: request.vehiculo_id, categoria_id: request.categoria_id, titulo: request.titulo, descripcion: request.descripcion, caracteristicas: request.caracteristicas || '', cantidad: String(request.cantidad) }} onSubmit={handleSubmit} saving={saving} error={error} /></div></section>
}

export default EditarSolicitud
