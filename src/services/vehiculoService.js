import { supabase } from './supabase.js'

const vehicleColumns = 'id, tipo_vehiculo_id, marca_id, modelo_id, anio, descripcion, fecha_creacion'

export async function obtenerTiposVehiculo() {
	const { data, error } = await supabase
		.from('tipos_vehiculo')
		.select('id, nombre, descripcion, activo, fecha_creacion')
		.eq('activo', true)
		.order('nombre')
	if (error) throw error
	return data
}

export async function obtenerMarcas() {
	const { data, error } = await supabase
		.from('marcas')
		.select('id, nombre, descripcion, activo, fecha_creacion')
		.eq('activo', true)
		.order('nombre')
	if (error) throw error
	return data
}

export async function obtenerModelos(marcaId, tipoVehiculoId) {
	let query = supabase
		.from('modelos')
		.select('id, marca_id, tipo_vehiculo_id, nombre, descripcion, activo, fecha_creacion')
		.eq('activo', true)
		.order('nombre')

	if (marcaId) query = query.eq('marca_id', marcaId)
	if (tipoVehiculoId) query = query.eq('tipo_vehiculo_id', tipoVehiculoId)

	const { data, error } = await query
	if (error) throw error
	return data
}

export async function obtenerVehiculosUsuario(userId) {
	const { data, error } = await supabase
		.from('vehiculos')
		.select(vehicleColumns)
		.eq('usuario_id', userId)
		.order('fecha_creacion', { ascending: false })
	if (error) throw error
	return data
}

export async function obtenerVehiculoPorId(id, userId) {
	const { data, error } = await supabase
		.from('vehiculos')
		.select(vehicleColumns)
		.eq('id', id)
		.eq('usuario_id', userId)
		.maybeSingle()
	if (error) throw error
	return data
}

export async function crearVehiculo(datos) {
	const { data, error } = await supabase
		.from('vehiculos')
		.insert({
			usuario_id: datos.usuario_id,
			tipo_vehiculo_id: datos.tipo_vehiculo_id,
			marca_id: datos.marca_id,
			modelo_id: datos.modelo_id,
			anio: datos.anio,
			descripcion: datos.descripcion || null,
		})
		.select(vehicleColumns)
		.single()
	if (error) throw error
	return data
}

export async function actualizarVehiculo(id, userId, datos) {
	const { data, error } = await supabase
		.from('vehiculos')
		.update({
			tipo_vehiculo_id: datos.tipo_vehiculo_id,
			marca_id: datos.marca_id,
			modelo_id: datos.modelo_id,
			anio: datos.anio,
			descripcion: datos.descripcion || null,
		})
		.eq('id', id)
		.eq('usuario_id', userId)
		.select(vehicleColumns)
		.maybeSingle()
	if (error) throw error
	if (!data) throw new Error('El vehículo no existe o no pertenece al usuario autenticado.')
	return data
}
