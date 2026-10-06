import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import {
	actualizarFotografiasTienda,
	actualizarTienda,
	crearTienda,
	eliminarFotografiaTienda,
	obtenerTiendaUsuario,
	subirFotografiaTienda,
} from '../../services/tiendaService.js'
import './TiendaPages.css'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const emptyForm = { nombre: '', descripcion: '', telefono: '', direccion: '', latitud: '', longitud: '', horario: '' }

function EditarTienda() {
	const { user } = useAuth()
	const navigate = useNavigate()
	const [form, setForm] = useState(emptyForm)
	const [store, setStore] = useState(null)
	const [existingPhotos, setExistingPhotos] = useState([])
	const [selectedFiles, setSelectedFiles] = useState([])
	const [previews, setPreviews] = useState([])
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [removingPhoto, setRemovingPhoto] = useState('')
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')

	useEffect(() => {
		let active = true
		async function loadStore() {
			try {
				const loadedStore = await obtenerTiendaUsuario(user.id)
				if (!active) return
				setStore(loadedStore)
				if (loadedStore) {
					setForm({ nombre: loadedStore.nombre || '', descripcion: loadedStore.descripcion || '', telefono: loadedStore.telefono || '', direccion: loadedStore.direccion || '', latitud: loadedStore.latitud ?? '', longitud: loadedStore.longitud ?? '', horario: loadedStore.horario || '' })
					setExistingPhotos(loadedStore.fotografias || [])
				}
			} catch (loadError) {
				if (active) setError(`No se pudo cargar tu tienda: ${loadError.message}`)
			} finally {
				if (active) setLoading(false)
			}
		}
		if (user?.id) loadStore()
		return () => { active = false }
	}, [user?.id])

	useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview)), [previews])

	function updateField(event) {
		setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
	}

	function handleFileChange(event) {
		setError('')
		const files = Array.from(event.target.files || [])
		const invalidFile = files.find((file) => !file.type.startsWith('image/') || file.size > MAX_IMAGE_SIZE)
		if (invalidFile) {
			setSelectedFiles([])
			setPreviews([])
			setError('Solo se permiten imágenes de hasta 5 MB cada una.')
			return
		}
		setSelectedFiles(files)
		setPreviews(files.map((file) => URL.createObjectURL(file)))
	}

	async function handleRemovePhoto(photoUrl) {
		setError('')
		setSuccess('')
		setRemovingPhoto(photoUrl)
		try {
			const remaining = existingPhotos.filter((photo) => photo !== photoUrl)
			await eliminarFotografiaTienda(user.id, photoUrl, remaining)
			setExistingPhotos(remaining)
			setSuccess('Fotografía eliminada correctamente.')
		} catch (removeError) {
			setError(`No se pudo eliminar la fotografía: ${removeError.message}`)
		} finally {
			setRemovingPhoto('')
		}
	}

	async function handleSubmit(event) {
		event.preventDefault()
		setError('')
		setSuccess('')
		if (!form.nombre.trim()) { setError('El nombre de la tienda es obligatorio.'); return }
		if (form.latitud !== '' && !Number.isFinite(Number(form.latitud))) { setError('La latitud debe ser un número válido.'); return }
		if (form.longitud !== '' && !Number.isFinite(Number(form.longitud))) { setError('La longitud debe ser un número válido.'); return }
		setSaving(true)
		try {
			const datos = { ...form }
			const savedStore = store ? await actualizarTienda(user.id, datos) : await crearTienda(user.id, datos)
			let photos = existingPhotos
			if (selectedFiles.length > 0) {
				const uploadedPhotos = []
				for (const file of selectedFiles) uploadedPhotos.push(await subirFotografiaTienda(user.id, file))
				photos = [...existingPhotos, ...uploadedPhotos]
				await actualizarFotografiasTienda(user.id, photos)
			}
			setStore({ ...savedStore, fotografias: photos })
			setExistingPhotos(photos)
			setSelectedFiles([])
			setPreviews([])
			setSuccess('Fotografías y datos guardados correctamente.')
			setTimeout(() => navigate('/tienda/perfil'), 700)
		} catch (saveError) {
			setError(`No se pudieron guardar los cambios: ${saveError.message}`)
		} finally {
			setSaving(false)
		}
	}

	if (loading) return <section className="store-page"><p className="store-message">Cargando información de tu tienda...</p></section>
	if (error && !form.nombre) return <section className="store-page"><p className="store-error" role="alert">{error}</p></section>

	return (
		<section className="store-page">
			<div className="store-form">
				<div className="store-page-heading"><div><p className="store-eyebrow">Panel de tienda / {store ? 'Editar' : 'Crear'}</p><h1>{store ? 'Edita tu tienda' : 'Crea tu tienda'}</h1><p className="store-lead">Mantén actualizada la información que verán tus clientes.</p></div></div>
				<form className="store-form-card" onSubmit={handleSubmit}>
					{error && <p className="store-error" role="alert">{error}</p>}
					{success && <p className="store-success" role="status">{success}</p>}
					<div className="store-form-grid">
						<label>Nombre<input name="nombre" value={form.nombre} onChange={updateField} required /></label>
						<label>Teléfono<input name="telefono" type="tel" value={form.telefono} onChange={updateField} /></label>
						<label className="store-field-full">Descripción<textarea name="descripcion" value={form.descripcion} onChange={updateField} /></label>
						<label className="store-field-full">Dirección<input name="direccion" value={form.direccion} onChange={updateField} /></label>
						<label>Latitud<input name="latitud" type="number" step="any" value={form.latitud} onChange={updateField} /></label>
						<label>Longitud<input name="longitud" type="number" step="any" value={form.longitud} onChange={updateField} /></label>
						<label className="store-field-full">Horario<input name="horario" value={form.horario} onChange={updateField} /></label>
					</div>
					<div className="store-photo-section">
						<div><p className="store-label">Fotografías de la tienda</p><small>Selecciona imágenes de hasta 5 MB cada una.</small></div>
						<input type="file" accept="image/*" multiple onChange={handleFileChange} />
						{previews.length > 0 && <div className="store-photo-grid">{previews.map((preview) => <img src={preview} alt="Vista previa" key={preview} />)}</div>}
						{existingPhotos.length > 0 ? <div className="store-photo-grid">{existingPhotos.map((photo) => <div className="store-photo-item" key={photo}><img src={photo} alt="Fotografía de la tienda" /><button type="button" onClick={() => handleRemovePhoto(photo)} disabled={removingPhoto === photo}>{removingPhoto === photo ? 'Eliminando...' : 'Eliminar'}</button></div>)}</div> : <p className="store-photo-empty">No hay fotografías registradas.</p>}
					</div>
					<div className="store-form-actions"><Link className="store-cancel" to="/tienda/perfil">Cancelar</Link><button className="store-button" type="submit" disabled={saving}>{saving ? 'Subiendo fotografías...' : store ? 'Guardar cambios' : 'Crear mi tienda'}</button></div>
				</form>
			</div>
		</section>
	)
}

export default EditarTienda
