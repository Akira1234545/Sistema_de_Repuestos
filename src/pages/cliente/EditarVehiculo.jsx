import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { actualizarVehiculo, obtenerVehiculoPorId } from '../../services/vehiculoService.js'
import { VehicleForm } from './VehicleForm.jsx'
import './Vehiculos.css'

function EditarVehiculo() {
	const { id } = useParams()
	const { user } = useAuth()
	const navigate = useNavigate()
	const [vehicle, setVehicle] = useState(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		async function loadVehicle() {
			try {
				const data = await obtenerVehiculoPorId(id, user.id)
				if (!data) setError('El vehículo no existe o no pertenece al usuario autenticado.')
				else if (active) setVehicle(data)
			} catch (loadError) { if (active) setError(`No se pudo cargar el vehículo: ${loadError.message}`) } finally { if (active) setLoading(false) }
		}
		if (user?.id && id) loadVehicle()
		return () => { active = false }
	}, [id, user?.id])

	async function handleSubmit(values, validationError) {
		if (validationError) { setError(validationError); return }
		setError(''); setSaving(true)
		try { await actualizarVehiculo(id, user.id, values); navigate('/cliente/vehiculos') } catch (saveError) { setError(`No se pudo actualizar el vehículo: ${saveError.message}`) } finally { setSaving(false) }
	}

	if (loading) return <section className="vehicles-page"><p className="vehicle-message">Cargando vehículo...</p></section>
	if (!vehicle) return <section className="vehicles-page"><p className="vehicle-error" role="alert">{error}</p></section>

	return <section className="vehicles-page"><div className="vehicle-form"><div className="vehicle-form-header"><p className="vehicles-eyebrow">Panel de cliente / Editar vehículo</p><h1>Actualiza tu vehículo</h1><p className="vehicle-form-lead">Modifica los datos que necesitas mantener al día.</p></div><VehicleForm initialValues={{ tipo_vehiculo_id: vehicle.tipo_vehiculo_id, marca_id: vehicle.marca_id, modelo_id: vehicle.modelo_id, anio: String(vehicle.anio), descripcion: vehicle.descripcion || '' }} onSubmit={handleSubmit} saving={saving} error={error} submitLabel="Guardar cambios" /></div></section>
}

export default EditarVehiculo
