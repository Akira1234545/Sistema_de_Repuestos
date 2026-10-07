import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { obtenerMarcas, obtenerModelos, obtenerTiposVehiculo } from '../../services/vehiculoService.js'

export function VehicleForm({ initialValues, onSubmit, saving, error, submitLabel }) {
	const [form, setForm] = useState(initialValues)
	const [types, setTypes] = useState([])
	const [brands, setBrands] = useState([])
	const [models, setModels] = useState([])
	const [loadingModels, setLoadingModels] = useState(false)
	const [loadingOptions, setLoadingOptions] = useState(true)
	const [optionsError, setOptionsError] = useState('')

	useEffect(() => {
		let active = true
		Promise.all([obtenerTiposVehiculo(), obtenerMarcas()]).then(([loadedTypes, loadedBrands]) => {
			if (active) { setTypes(loadedTypes); setBrands(loadedBrands) }
		}).catch((loadError) => { if (active) setOptionsError(`No se pudieron cargar los catálogos: ${loadError.message}`) }).finally(() => { if (active) setLoadingOptions(false) })
		return () => { active = false }
	}, [])

	useEffect(() => {
		let active = true
		if (!form.marca_id || !form.tipo_vehiculo_id) {
			return undefined
		}

		Promise.resolve().then(() => {
			if (active) { setModels([]); setLoadingModels(true); setOptionsError('') }
			return obtenerModelos(form.marca_id, form.tipo_vehiculo_id)
		})
			.then((data) => { if (active) setModels(data) })
			.catch((loadError) => { if (active) setOptionsError(`No se pudieron cargar los modelos: ${loadError.message}`) })
			.finally(() => { if (active) setLoadingModels(false) })
		return () => { active = false }
	}, [form.marca_id, form.tipo_vehiculo_id])

	function updateField(event) {
		const { name, value } = event.target
		setForm((current) => ({ ...current, [name]: value, ...(name === 'marca_id' || name === 'tipo_vehiculo_id' ? { modelo_id: '' } : {}) }))
	}

	function handleSubmit(event) {
		event.preventDefault()
		const currentYear = new Date().getFullYear()
		const validationError = !form.tipo_vehiculo_id ? 'Selecciona un tipo de vehículo.' : !form.marca_id ? 'Selecciona una marca.' : !form.modelo_id ? 'Selecciona un modelo.' : !form.anio ? 'Escribe el año del vehículo.' : !Number.isInteger(Number(form.anio)) || Number(form.anio) < 1886 || Number(form.anio) > currentYear + 1 ? `El año debe estar entre 1886 y ${currentYear + 1}.` : ''
		if (validationError) { onSubmit(null, validationError); return }
		onSubmit({ ...form, anio: Number(form.anio) })
	}

	if (loadingOptions) return <p className="vehicle-message">Cargando tipos, marcas y modelos...</p>
	if (optionsError) return <p className="vehicle-error" role="alert">{optionsError}</p>
	if (types.length === 0 || brands.length === 0) return <div className="vehicle-error" role="status"><strong>Catálogo de vehículos incompleto.</strong><p>{types.length === 0 ? 'No hay tipos de vehículo activos.' : ''}{types.length === 0 && brands.length === 0 ? ' ' : ''}{brands.length === 0 ? 'No hay marcas activas.' : ''} Pide al administrador que revise los catálogos y permisos de lectura en Supabase.</p></div>

	return <form className="vehicle-form-card" onSubmit={handleSubmit}>{error && <p className="vehicle-form-error" role="alert">{error}</p>}<div className="vehicle-form-grid"><label className="vehicle-field">Tipo de vehículo<select name="tipo_vehiculo_id" value={form.tipo_vehiculo_id} onChange={updateField} required><option value="">Selecciona un tipo</option>{types.map((type) => <option value={type.id} key={type.id}>{type.nombre}</option>)}</select></label><label className="vehicle-field">Marca<select name="marca_id" value={form.marca_id} onChange={updateField} required><option value="">Selecciona una marca</option>{brands.map((brand) => <option value={brand.id} key={brand.id}>{brand.nombre}</option>)}</select></label><label className="vehicle-field">Modelo<select name="modelo_id" value={form.modelo_id} onChange={updateField} required disabled={!form.marca_id || !form.tipo_vehiculo_id || loadingModels}><option value="">{loadingModels ? 'Cargando modelos...' : models.length === 0 ? 'No hay modelos compatibles con este tipo y marca' : 'Selecciona un modelo'}</option>{models.map((model) => <option value={model.id} key={model.id}>{model.nombre}</option>)}</select>{form.marca_id && form.tipo_vehiculo_id && !loadingModels && models.length === 0 && <small role="status">No hay modelos activos para esta combinación. Comprueba los filtros del catálogo.</small>}</label><label className="vehicle-field">Año<input name="anio" type="number" min="1886" max={new Date().getFullYear() + 1} step="1" value={form.anio} onChange={updateField} required /></label><label className="vehicle-field vehicle-field-full">Descripción<textarea name="descripcion" value={form.descripcion} onChange={updateField} placeholder="Información adicional del vehículo (opcional)" /></label></div><div className="vehicle-form-actions"><Link className="vehicle-cancel" to="/cliente/vehiculos">Cancelar</Link><button className="button vehicle-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : submitLabel}</button></div></form>
}
