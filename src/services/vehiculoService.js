import { supabase } from './supabase.js'

const vehicleColumns = 'id, tipo_vehiculo_id, marca_id, modelo_id, anio, descripcion, fecha_creacion'

async function getNamesByIds(table, ids) {
	if (!ids.length) return new Map()
	const { data, error } = await supabase.from(table).select('id, nombre').in('id', ids)
	if (error) throw error
	return new Map(data.map((item) => [item.id, item.nombre]))
}

async function enrichVehicles(vehicles) {
	const [types, brands, models] = await Promise.all([
		getNamesByIds('tipos_vehiculo', vehicles.map((item) => item.tipo_vehiculo_id)),
		getNamesByIds('marcas', vehicles.map((item) => item.marca_id)),
		getNamesByIds('modelos', vehicles.map((item) => item.modelo_id)),
	])
	return vehicles.map((item) => ({ ...item, tipoNombre: types.get(item.tipo_vehiculo_id), marcaNombre: brands.get(item.marca_id), modeloNombre: models.get(item.modelo_id) }))
}

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
	return enrichVehicles(data)
}

export async function obtenerVehiculoPorId(id, userId) {
	const { data, error } = await supabase
		.from('vehiculos')
		.select(vehicleColumns)
		.eq('id', id)
		.eq('usuario_id', userId)
		.maybeSingle()
	if (error) throw error
	return data ? (await enrichVehicles([data]))[0] : null
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
