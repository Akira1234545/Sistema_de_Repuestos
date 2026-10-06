import { supabase } from './supabase.js'

const requestColumns = `
	id,
	usuario_id,
	vehiculo_id,
	categoria_id,
	titulo,
	descripcion,
	caracteristicas,
	cantidad,
	fotografias,
	estado,
	fecha_creacion,
	fecha_actualizacion,
	propuesta_seleccionada_id
`

async function getNamesByIds(table, ids) {
	if (ids.length === 0) return new Map()

	const { data, error } = await supabase
		.from(table)
		.select('id, nombre')
		.in('id', ids)

	if (error) throw error
	return new Map(data.map((item) => [item.id, item.nombre]))
}

async function enrichVehicles(vehicles) {
	const [types, brands, models] = await Promise.all([
		getNamesByIds('tipos_vehiculo', vehicles.map((vehicle) => vehicle.tipo_vehiculo_id)),
		getNamesByIds('marcas', vehicles.map((vehicle) => vehicle.marca_id)),
		getNamesByIds('modelos', vehicles.map((vehicle) => vehicle.modelo_id)),
	])

	return vehicles.map((vehicle) => ({
		...vehicle,
		tipoNombre: types.get(vehicle.tipo_vehiculo_id),
		marcaNombre: brands.get(vehicle.marca_id),
		modeloNombre: models.get(vehicle.modelo_id),
	}))
}

export async function obtenerVehiculosUsuario(userId) {
	const { data, error } = await supabase
		.from('vehiculos')
		.select('id, usuario_id, tipo_vehiculo_id, marca_id, modelo_id, anio, descripcion, fecha_creacion')
		.eq('usuario_id', userId)
		.order('fecha_creacion', { ascending: false })

	if (error) throw error
	return enrichVehicles(data)
}

export async function obtenerCategoriasActivas() {
	const { data, error } = await supabase
		.from('categorias_repuesto')
		.select('id, nombre, descripcion, categoria_padre_id, activo, fecha_creacion')
		.eq('activo', true)
		.order('nombre')

	if (error) throw error
	return data
}

async function enrichRequests(requests) {
	if (requests.length === 0) return []

	const vehicles = await obtenerVehiclesByIds(requests.map((request) => request.vehiculo_id))
	const categories = await getNamesByIds('categorias_repuesto', requests.map((request) => request.categoria_id))
	const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))

	return requests.map((request) => ({
		...request,
		vehiculo: vehicleById.get(request.vehiculo_id),
		categoriaNombre: categories.get(request.categoria_id),
	}))
}

async function enrichAvailableRequests(requests) {
	try {
		return await enrichRequests(requests)
	} catch {
		return requests.map((request) => ({
			...request,
			vehiculo: null,
			categoriaNombre: null,
		}))
	}
}

async function obtenerVehiclesByIds(ids) {
	const { data, error } = await supabase
		.from('vehiculos')
		.select('id, usuario_id, tipo_vehiculo_id, marca_id, modelo_id, anio, descripcion, fecha_creacion')
		.in('id', ids)

	if (error) throw error
	return enrichVehicles(data)
}

export async function obtenerSolicitudesUsuario(userId) {
	const { data, error } = await supabase
		.from('solicitudes')
		.select(requestColumns)
		.eq('usuario_id', userId)
		.order('fecha_creacion', { ascending: false })

	if (error) throw error
	return enrichRequests(data)
}

export async function obtenerSolicitudesDisponibles() {
	const { data, error } = await supabase
		.from('solicitudes')
		.select(requestColumns)
		.in('estado', ['publicada', 'recibiendo_propuestas'])
		.order('fecha_creacion', { ascending: false })

	console.log('=== DEBUG SOLICITUDES TIENDA ===')
	console.log('SOLICITUDES RECIBIDAS:', data)
	console.log('CANTIDAD DE SOLICITUDES:', data?.length)
	console.log('ERROR SOLICITUDES:', error)
	if (data?.length) {
		console.log('DETALLE DE SOLICITUDES:', JSON.stringify(data, null, 2))
	}

	if (error) throw error
	const resultado = await enrichAvailableRequests(data)
	console.log('SOLICITUDES QUE SE RETORNAN:', resultado)
	console.log('CANTIDAD QUE SE RETORNA:', resultado?.length)
	return resultado
}

export async function obtenerSolicitudDisponiblePorId(id) {
	const { data, error } = await supabase
		.from('solicitudes')
		.select(requestColumns)
		.eq('id', id)
		.in('estado', ['publicada', 'recibiendo_propuestas'])
		.maybeSingle()

	if (error) throw error
	if (!data) return null
	const [request] = await enrichAvailableRequests([data])
	return request
}

export async function obtenerSolicitudPorId(id, userId) {
	const { data, error } = await supabase
		.from('solicitudes')
		.select(requestColumns)
		.eq('id', id)
		.eq('usuario_id', userId)
		.maybeSingle()

	if (error) throw error
	if (!data) return null
	const [request] = await enrichRequests([data])
	return request
}

export async function crearSolicitud(datos) {
	const { data, error } = await supabase
		.from('solicitudes')
		.insert({
			usuario_id: datos.usuario_id,
			vehiculo_id: datos.vehiculo_id,
			categoria_id: datos.categoria_id,
			titulo: datos.titulo,
			descripcion: datos.descripcion,
			caracteristicas: datos.caracteristicas || null,
			cantidad: datos.cantidad,
		})
		.select(requestColumns)
		.single()

	if (error) throw error
	return data
}

export async function actualizarSolicitud(id, userId, datos) {
	const { data, error } = await supabase
		.from('solicitudes')
		.update({
			vehiculo_id: datos.vehiculo_id,
			categoria_id: datos.categoria_id,
			titulo: datos.titulo,
			descripcion: datos.descripcion,
			caracteristicas: datos.caracteristicas || null,
			cantidad: datos.cantidad,
		})
		.eq('id', id)
		.eq('usuario_id', userId)
		.select(requestColumns)
		.maybeSingle()

	if (error) throw error
	if (!data) throw new Error('La solicitud no existe o no pertenece al usuario autenticado.')
	return data
}
