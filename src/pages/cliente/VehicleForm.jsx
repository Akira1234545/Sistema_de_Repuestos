import { publicError } from '../../lib/errors.js'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { obtenerMarcas, obtenerMarcasDeTipo, obtenerModelos, obtenerTiposVehiculo } from '../../services/vehiculoService.js'
import { useFormDraft } from '../../hooks/useFormDraft.js'
import { vehicleYearLimit } from '../../lib/format.js'
import Select from '../../components/ui/Select.jsx'

// «Otra marca» y «Otro modelo (indícalo en la descripción)» van al final de su lista.
const isOther = (label) => /^otr[ao] /i.test(label)
const othersLast = (options) => [...options.filter((option) => !isOther(option.label)), ...options.filter((option) => isOther(option.label))]

export function VehicleForm({ initialValues, onSubmit, saving, error, submitLabel }) {
	const [form, setForm] = useFormDraft(initialValues)
	const [types, setTypes] = useState([])
	const [brands, setBrands] = useState([])
	const [models, setModels] = useState([])
	const [typeBrands, setTypeBrands] = useState({ typeId: '', ids: null })
	const [loadingModels, setLoadingModels] = useState(false)
	const [loadingOptions, setLoadingOptions] = useState(true)
	const [optionsError, setOptionsError] = useState('')
	const [modelError, setModelError] = useState('')
	const [retry, setRetry] = useState(0)

	useEffect(() => {
		let active = true
		Promise.all([obtenerTiposVehiculo(), obtenerMarcas()]).then(([loadedTypes, loadedBrands]) => {
			if (active) { setTypes(loadedTypes); setBrands(loadedBrands) }
		}).catch((loadError) => { if (active) setOptionsError(`No se pudieron cargar los catálogos: ${publicError(loadError)}`) }).finally(() => { if (active) setLoadingOptions(false) })
		return () => { active = false }
	}, [retry])

	// Q02: al elegir el tipo se cargan solo las marcas que tienen modelos de ese tipo.
	useEffect(() => {
		let active = true
		if (!form.tipo_vehiculo_id) return undefined
		obtenerMarcasDeTipo(form.tipo_vehiculo_id)
			.then((ids) => { if (active) setTypeBrands({ typeId: form.tipo_vehiculo_id, ids }) })
			.catch(() => { if (active) setTypeBrands({ typeId: form.tipo_vehiculo_id, ids: null }) })
		return () => { active = false }
	}, [form.tipo_vehiculo_id, retry])

	useEffect(() => {
		let active = true
		if (!form.marca_id || !form.tipo_vehiculo_id) {
			return undefined
		}

		Promise.resolve().then(() => {
			if (active) { setModels([]); setLoadingModels(true); setModelError('') }
			return obtenerModelos(form.marca_id, form.tipo_vehiculo_id)
		})
			.then((data) => { if (active) setModels(data) })
			.catch(() => { if (active) setModelError('No se pudieron cargar los modelos. Cambia la selección o reintenta.') })
			.finally(() => { if (active) setLoadingModels(false) })
		return () => { active = false }
	}, [form.marca_id, form.tipo_vehiculo_id, retry])

	function updateField(event) {
		const { name, value } = event.target
		setForm((current) => ({ ...current, [name]: value, ...(name === 'tipo_vehiculo_id' && value !== current.tipo_vehiculo_id ? { marca_id: '', modelo_id: '' } : {}), ...(name === 'marca_id' ? { modelo_id: '' } : {}) }))
	}

	function handleSubmit(event) {
		event.preventDefault()
		const currentYear = vehicleYearLimit() - 1
		const validationError = !form.tipo_vehiculo_id ? 'Selecciona un tipo de vehículo.' : !form.marca_id ? 'Selecciona una marca.' : !form.modelo_id ? 'Selecciona un modelo.' : !form.anio ? 'Escribe el año del vehículo.' : !Number.isInteger(Number(form.anio)) || Number(form.anio) < 1886 || Number(form.anio) > currentYear + 1 ? `El año debe estar entre 1886 y ${currentYear + 1}.` : ''
		if (validationError) { onSubmit(null, validationError); return }
		onSubmit({ ...form, anio: Number(form.anio) })
	}

	const brandsReady = typeBrands.typeId === form.tipo_vehiculo_id
	// Si falló la consulta de marcas por tipo se muestran todas (mejor que bloquear el formulario).
	const brandOptions = !form.tipo_vehiculo_id || !brandsReady ? [] : othersLast(brands
		.filter((brand) => !typeBrands.ids || typeBrands.ids.includes(brand.id) || brand.id === form.marca_id)
		.map((brand) => ({ value: brand.id, label: brand.nombre })))
	const brandPlaceholder = !form.tipo_vehiculo_id ? 'Elige el tipo primero' : !brandsReady ? 'Cargando marcas…' : brandOptions.length === 0 ? 'No hay marcas para este tipo' : 'Selecciona una marca'

	if (loadingOptions) return <p className="vehicle-message">Cargando tipos, marcas y modelos...</p>
	if (optionsError) return <div className="vehicle-error" role="alert"><p>No se pudieron cargar los catálogos.</p><button className="button" type="button" onClick={() => { setOptionsError(''); setLoadingOptions(true); setRetry(value => value + 1) }}>Reintentar</button></div>
	if (types.length === 0 || brands.length === 0) return <div className="vehicle-error" role="status"><strong>Catálogo de vehículos incompleto.</strong><p>{types.length === 0 ? 'No hay tipos de vehículo activos.' : ''}{types.length === 0 && brands.length === 0 ? ' ' : ''}{brands.length === 0 ? 'No hay marcas activas.' : ''} Pide al administrador que revise los catálogos y permisos de lectura en Supabase.</p></div>

	return <form className="vehicle-form-card" onSubmit={handleSubmit}>{modelError && <p role="alert">{modelError}<button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></p>}{error && <p className="vehicle-form-error" role="alert">{error}</p>}<div className="vehicle-form-grid"><label className="vehicle-field">Tipo de vehículo<Select ariaLabel="Tipo de vehículo" name="tipo_vehiculo_id" value={form.tipo_vehiculo_id} onChange={updateField} required placeholder="Selecciona un tipo" options={types.map((type) => ({ value: type.id, label: type.nombre }))} /></label><label className="vehicle-field">Marca<Select ariaLabel="Marca" name="marca_id" value={form.marca_id} onChange={updateField} required disabled={!form.tipo_vehiculo_id || !brandsReady || brandOptions.length === 0} placeholder={brandPlaceholder} options={brandOptions} /></label><label className="vehicle-field">Modelo<Select ariaLabel="Modelo" name="modelo_id" value={form.modelo_id} onChange={updateField} required disabled={!form.marca_id || !form.tipo_vehiculo_id || loadingModels} placeholder={loadingModels ? 'Cargando modelos…' : !form.marca_id || !form.tipo_vehiculo_id ? (!form.tipo_vehiculo_id ? 'Elige el tipo primero' : 'Elige la marca primero') : models.length === 0 ? 'No hay modelos para este tipo y marca' : 'Selecciona un modelo'} options={othersLast(models.map((model) => ({ value: model.id, label: model.nombre })))} />{form.marca_id && form.tipo_vehiculo_id && !loadingModels && models.length === 0 && <small role="status">Todavía no tenemos modelos de esta marca para este tipo. Revisa que elegiste bien el tipo (auto, moto…) y la marca.</small>}</label><label className="vehicle-field">Año<input name="anio" type="number" min="1886" max={vehicleYearLimit()} step="1" value={form.anio} onChange={updateField} required /></label><label className="vehicle-field vehicle-field-full">Descripción<textarea name="descripcion" value={form.descripcion} onChange={updateField} maxLength={1000} placeholder="Información adicional del vehículo (opcional)" /></label></div><div className="vehicle-form-actions"><Link className="vehicle-cancel" to="/cliente/vehiculos">Cancelar</Link><button className="button vehicle-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : submitLabel}</button></div></form>
}
