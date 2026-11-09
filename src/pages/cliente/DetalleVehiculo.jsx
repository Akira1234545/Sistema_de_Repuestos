import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '../../components/Icon.jsx'
import { useAuth } from '../../context/authState.js'
import { useToast } from '../../context/toastState.js'
import { publicError } from '../../lib/errors.js'
import { canCapturePhoto } from '../../lib/platform.js'
import { vehicleName } from '../../lib/vehicles.js'
import { actualizarNotasVehiculo, agregarFotoVehiculo, contarSolicitudesPorVehiculo, eliminarVehiculo, obtenerVehiculoPorId, quitarFotoVehiculo } from '../../services/vehiculoService.js'

const MAX_PHOTOS = 4

export default function DetalleVehiculo() {
	const { id } = useParams()
	const { user } = useAuth()
	const navigate = useNavigate()
	const toast = useToast()
	const fileRef = useRef(null)
	const cameraRef = useRef(null)
	const [vehicle, setVehicle] = useState(null)
	const [requests, setRequests] = useState(0)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [busy, setBusy] = useState('')
	const [notes, setNotes] = useState('')
	const [editingNotes, setEditingNotes] = useState(false)
	const [viewer, setViewer] = useState('')
	const [confirmDelete, setConfirmDelete] = useState(false)

	useEffect(() => {
		let active = true
		Promise.all([obtenerVehiculoPorId(id, user.id), contarSolicitudesPorVehiculo([id])])
			.then(([data, counts]) => {
				if (!active) return
				if (!data) { setError('El vehículo no existe o no es tuyo.'); return }
				setVehicle(data); setNotes(data.descripcion || ''); setRequests(counts[id] || 0)
			})
			.catch((loadError) => { if (active) setError(`No se pudo cargar el vehículo: ${publicError(loadError)}`) })
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [id, user.id])

	function merge(updated) { setVehicle((current) => ({ ...current, ...updated })) }

	async function addPhoto(event) {
		const file = event.target.files?.[0]
		event.target.value = ''
		if (!file) return
		setBusy('photo'); setError('')
		try { merge(await agregarFotoVehiculo(vehicle, user.id, file)); toast({ title: 'Foto agregada', tone: 'success' }) }
		catch (photoError) { setError(photoError.message?.startsWith('Puedes') || photoError.message?.startsWith('Elige') || photoError.message?.startsWith('No se pudo') ? photoError.message : `No se pudo subir la foto: ${publicError(photoError)}`) }
		finally { setBusy('') }
	}
	async function removePhoto(url) {
		setBusy(url); setError('')
		try { merge(await quitarFotoVehiculo(vehicle, user.id, url)); setViewer('') }
		catch (photoError) { setError(`No se pudo quitar la foto: ${publicError(photoError)}`) }
		finally { setBusy('') }
	}
	async function saveNotes(event) {
		event.preventDefault()
		setBusy('notes'); setError('')
		try { merge(await actualizarNotasVehiculo(id, user.id, notes)); setEditingNotes(false); toast({ title: 'Notas guardadas', tone: 'success' }) }
		catch (saveError) { setError(`No se pudieron guardar las notas: ${publicError(saveError)}`) }
		finally { setBusy('') }
	}
	async function remove() {
		setBusy('delete'); setError('')
		try { await eliminarVehiculo(id, user.id, vehicle.fotos || []); toast({ title: 'Vehículo eliminado', tone: 'success' }); navigate('/cliente/vehiculos', { replace: true }) }
		catch (deleteError) { setError(deleteError.message?.startsWith('No se puede') ? deleteError.message : `No se pudo eliminar: ${publicError(deleteError)}`); setBusy('') }
	}

	if (loading) return <section className="vehicles-page"><p className="vehicle-message" role="status">Cargando vehículo…</p></section>
	if (!vehicle) return <section className="vehicles-page"><p className="vehicle-error" role="alert">{error}</p><Link to="/cliente/vehiculos">Volver a mis vehículos</Link></section>

	const photos = vehicle.fotos || []
	const locked = requests > 0
	return <section className="vehicles-page vehicle-detail">
		<div className="vehicle-detail-head">
			<Link className="icon-action" to="/cliente/vehiculos" aria-label="Volver a mis vehículos"><Icon name="chevron" size={18} /></Link>
			<div><p className="vehicles-eyebrow">Mi vehículo</p><h1>{vehicleName(vehicle)}</h1><p className="vehicle-detail-sub">{[vehicle.anio, vehicle.tipoNombre].filter(Boolean).join(' · ')}</p></div>
		</div>
		{error && <p className="vehicle-error" role="alert">{error}</p>}

		<section className="vehicle-gallery" aria-label="Fotos del vehículo">
			{photos.map((url, index) => <figure key={url} className="vehicle-photo">
				<button type="button" className="vehicle-photo-open" onClick={() => setViewer(url)} aria-label={`Ampliar foto ${index + 1}`}><img src={url} alt={`Foto ${index + 1} de ${vehicleName(vehicle)}`} loading="lazy" /></button>
				<button type="button" className="icon-action is-danger vehicle-photo-remove" onClick={() => removePhoto(url)} disabled={Boolean(busy)} aria-label={`Quitar foto ${index + 1}`}><Icon name="trash" size={16} /></button>
			</figure>)}
			{photos.length < MAX_PHOTOS && <button type="button" className="vehicle-photo-add" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
				<Icon name="plus" size={24} /><span>{busy === 'photo' ? 'Subiendo…' : photos.length ? 'Agregar foto' : 'Agrega fotos de tu vehículo'}</span><small>{canCapturePhoto ? 'Desde la galería · ' : ''}{photos.length}/{MAX_PHOTOS}</small>
			</button>}
			{canCapturePhoto && photos.length < MAX_PHOTOS && <button type="button" className="vehicle-photo-add" onClick={() => cameraRef.current?.click()} disabled={Boolean(busy)}>
				<Icon name="camera" size={24} /><span>Tomar foto</span><small>Con la cámara</small>
			</button>}
			<input ref={fileRef} type="file" accept="image/*" hidden onChange={addPhoto} />
			<input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={addPhoto} />
		</section>

		<dl className="vehicle-specs">
			<div><dt>Tipo</dt><dd>{vehicle.tipoNombre || '—'}</dd></div>
			<div><dt>Marca</dt><dd>{vehicle.marcaNombre || '—'}</dd></div>
			<div><dt>Modelo</dt><dd>{vehicle.modeloNombre || '—'}</dd></div>
			<div><dt>Año</dt><dd>{vehicle.anio}</dd></div>
			<div><dt>Solicitudes</dt><dd>{requests}</dd></div>
			<div><dt>Registrado</dt><dd>{new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeZone: 'America/La_Paz' }).format(new Date(vehicle.fecha_creacion))}</dd></div>
		</dl>

		{locked && <p className="vehicle-lock-note"><Icon name="lock" size={16} /> Tiene {requests} {requests === 1 ? 'solicitud' : 'solicitudes'}: el tipo, la marca, el modelo y el año quedan fijos para que las cotizaciones sigan siendo válidas. Puedes editar las notas y las fotos.</p>}

		<section className="vehicle-notes">
			<div className="vehicle-notes-head"><h2>Notas</h2>{!editingNotes && <button type="button" className="icon-action" onClick={() => setEditingNotes(true)} aria-label="Editar notas"><Icon name="edit" size={16} /></button>}</div>
			{editingNotes
				? <form onSubmit={saveNotes} className="vehicle-notes-form">
					<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={4} placeholder="Color, motor, versión, detalles que ayuden a la tienda…" aria-label="Notas del vehículo" aria-describedby="vehicle-notes-privacy" />
					<div className="vehicle-notes-actions"><button type="button" className="button button-secondary" onClick={() => { setNotes(vehicle.descripcion || ''); setEditingNotes(false) }}>Cancelar</button><button className="button" disabled={busy === 'notes'}>{busy === 'notes' ? 'Guardando…' : 'Guardar notas'}</button></div>
				</form>
				: <p className={vehicle.descripcion ? '' : 'is-empty'}>{vehicle.descripcion || 'Sin notas. Añade color, motor o versión para que las tiendas acierten con el repuesto.'}</p>}
			<small id="vehicle-notes-privacy" className="vehicle-notes-privacy">Las tiendas que reciban tus solicitudes verán estas notas y las fotos. No incluyas la placa ni datos personales.</small>
		</section>

		<div className="vehicle-detail-actions">
			<Link className="button" to={`/cliente/solicitudes/crear?vehiculo=${vehicle.id}`}><Icon name="plus" size={18} /> Pedir un repuesto</Link>
			{!locked && <Link className="button button-secondary" to={`/cliente/vehiculos/editar/${vehicle.id}`}><Icon name="edit" size={18} /> Editar datos</Link>}
			{!locked && (confirmDelete
				? <span className="request-confirm"><span>¿Eliminar este vehículo?</span><button type="button" className="icon-action is-danger is-wide" onClick={remove} disabled={busy === 'delete'}>{busy === 'delete' ? 'Eliminando…' : 'Sí, eliminar'}</button><button type="button" className="icon-action is-wide" onClick={() => setConfirmDelete(false)}>No</button></span>
				: <button type="button" className="icon-action is-danger" onClick={() => setConfirmDelete(true)} aria-label="Eliminar vehículo" title="Eliminar"><Icon name="trash" size={18} /></button>)}
		</div>

		{viewer && <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={() => setViewer('')}>
			<img src={viewer} alt={`Foto de ${vehicleName(vehicle)}`} />
			<button type="button" className="icon-action" aria-label="Cerrar" onClick={() => setViewer('')}><Icon name="x" size={18} /></button>
		</div>}
	</section>
}
