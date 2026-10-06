import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { crearVehiculo } from '../../services/vehiculoService.js'
import { VehicleForm } from './VehicleForm.jsx'
import './Vehiculos.css'

function CrearVehiculo() {
	const { user } = useAuth()
	const navigate = useNavigate()
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')

	async function handleSubmit(values, validationError) {
		if (validationError) { setError(validationError); return }
		setError(''); setSaving(true)
		try { await crearVehiculo({ ...values, usuario_id: user.id }); navigate('/cliente/vehiculos') } catch (saveError) { setError(`No se pudo crear el vehículo: ${saveError.message}`) } finally { setSaving(false) }
	}

	return <section className="vehicles-page"><div className="vehicle-form"><div className="vehicle-form-header"><p className="vehicles-eyebrow">Panel de cliente / Nuevo vehículo</p><h1>Registra tu vehículo</h1><p className="vehicle-form-lead">Completa los datos para tenerlo disponible cuando busques repuestos.</p></div><VehicleForm initialValues={{ tipo_vehiculo_id: '', marca_id: '', modelo_id: '', anio: '', descripcion: '' }} onSubmit={handleSubmit} saving={saving} error={error} submitLabel="Guardar vehículo" /></div></section>
}

export default CrearVehiculo
