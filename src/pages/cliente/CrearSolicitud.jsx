import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { crearSolicitud, obtenerCategoriasActivas, obtenerVehiculosUsuario } from '../../services/solicitudService.js'
import './Solicitudes.css'

const initialForm = { vehiculo_id: '', categoria_id: '', titulo: '', descripcion: '', caracteristicas: '', cantidad: '1' }

export function SolicitudForm({ editingId = null, initialValues = initialForm, onSubmit, saving, error }) {
	const [form, setForm] = useState(initialValues)
	const [vehicles, setVehicles] = useState([])
	const [categories, setCategories] = useState([])
	const [loadingOptions, setLoadingOptions] = useState(true)
	const [optionsError, setOptionsError] = useState('')

	useEffect(() => {
		let active = true
		Promise.all([obtenerVehiculosUsuario(initialValues.userId), obtenerCategoriasActivas()])
			.then(([loadedVehicles, loadedCategories]) => {
				if (active) { setVehicles(loadedVehicles); setCategories(loadedCategories) }
			})
			.catch((loadError) => { if (active) setOptionsError(`No se pudieron cargar las opciones: ${loadError.message}`) })
			.finally(() => { if (active) setLoadingOptions(false) })
		return () => { active = false }
	}, [initialValues.userId])

	function updateField(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })) }
	function handleSubmit(event) {
		event.preventDefault()
		const validationError = !form.vehiculo_id ? 'Selecciona un vehículo.' : !form.categoria_id ? 'Selecciona una categoría.' : !form.titulo.trim() ? 'Escribe un título.' : !form.descripcion.trim() ? 'Escribe una descripción.' : !Number.isInteger(Number(form.cantidad)) || Number(form.cantidad) <= 0 ? 'La cantidad debe ser un entero mayor que cero.' : ''
		if (validationError) { onSubmit(null, validationError); return }
		onSubmit({ ...form, cantidad: Number(form.cantidad) })
	}

	if (loadingOptions) return <p className="request-loading">Cargando vehículos y categorías...</p>
	if (optionsError) return <p className="request-error" role="alert">{optionsError}</p>
	if (vehicles.length === 0) return <div className="request-no-vehicles">No tienes vehículos registrados.<br /><Link to="/cliente/vehiculos/crear">Registrar vehículo ↗</Link></div>

	return <form className="request-form-card" onSubmit={handleSubmit}>{(error) && <p className="request-form-error" role="alert">{error}</p>}<div className="request-form-grid"><label className="request-field">Vehículo<select name="vehiculo_id" value={form.vehiculo_id} onChange={updateField} required><option value="">Selecciona tu vehículo</option>{vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{[vehicle.marcaNombre, vehicle.modeloNombre, vehicle.anio].filter(Boolean).join(' ')}</option>)}</select></label><label className="request-field">Categoría<select name="categoria_id" value={form.categoria_id} onChange={updateField} required><option value="">Selecciona una categoría</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.nombre}</option>)}</select></label><label className="request-field request-field-full">Título<input name="titulo" value={form.titulo} onChange={updateField} required placeholder="Ej. Necesito pastillas de freno" /></label><label className="request-field request-field-full">Descripción<textarea name="descripcion" value={form.descripcion} onChange={updateField} required placeholder="Cuéntanos qué repuesto necesitas..." /></label><label className="request-field request-field-full">Características <small>Opcional</small><textarea name="caracteristicas" value={form.caracteristicas} onChange={updateField} placeholder="Medidas, marca preferida u otros detalles" /></label><label className="request-field">Cantidad<input name="cantidad" type="number" min="1" step="1" value={form.cantidad} onChange={updateField} required /></label></div><div className="request-form-actions"><Link className="button request-cancel" to="/cliente/solicitudes">Cancelar</Link><button className="button requests-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear solicitud'}</button></div></form>
}

function CrearSolicitud() {
	const { user } = useAuth()
	const navigate = useNavigate()
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')

	async function handleSubmit(values, validationError) {
		if (validationError) { setError(validationError); return }
		setError(''); setSaving(true)
		try { await crearSolicitud({ ...values, usuario_id: user.id }); navigate('/cliente/solicitudes') } catch (saveError) { setError(`No se pudo crear la solicitud: ${saveError.message}`) } finally { setSaving(false) }
	}

	return <section className="requests-page"><div className="request-form"><div className="request-form-header"><p className="requests-eyebrow">Panel de cliente / Nueva solicitud</p><h1>Encuentra el repuesto que necesitas</h1><p className="request-form-lead">Cuéntanos qué buscas y prepara tu solicitud para las tiendas.</p></div><SolicitudForm initialValues={{ ...initialForm, userId: user.id }} onSubmit={handleSubmit} saving={saving} error={error} /></div></section>
}

export default CrearSolicitud
