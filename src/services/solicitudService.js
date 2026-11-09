import { catalogNames } from './catalogService.js'
import { supabase } from './supabase.js'
import { clearFormDrafts } from '../lib/formDrafts.js'
import { createOnce } from './createOnce.js'
import { isProjectPhotoUrl } from '../lib/storageUrls.js'

const requestColumns = `
	id,
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

async function getNamesByIds(table, ids) { return catalogNames(table, ids) }

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
		.select('id, tipo_vehiculo_id, marca_id, modelo_id, anio, descripcion, fecha_creacion')
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
		.select('id, tipo_vehiculo_id, marca_id, modelo_id, anio, descripcion, fotos, fecha_creacion')
		.in('id', ids)

	if (error) throw error
	const projectUrl = import.meta.env?.VITE_SUPABASE_URL
	return enrichVehicles(data.map((item) => ({ ...item, fotos: (item.fotos || []).filter((url) => isProjectPhotoUrl(url, projectUrl, 'vehiculos')) })))
}

async function requestPage(available, page, filters) {
	const { data, error } = await supabase.rpc('request_page', {
		p_available: available, p_search: filters.search || null, p_state: filters.status || null,
		p_category: filters.category || null, p_from: filters.from || null, p_to: filters.to || null,
		p_offset: page * 25, p_limit: 26,
	}).select(requestColumns)
	if (error) throw error
	return { items: await enrichRequests(data.slice(0, 25)), hasMore: data.length > 25 }
}
export async function obtenerSolicitudesUsuario(userId, page = 0, filters = {}) {
	if (!userId) throw new Error('Inicia sesión para consultar solicitudes.')
	return requestPage(false, page, filters)
}
export async function obtenerSolicitudesDisponibles(page = 0, filters = {}) {
	return requestPage(true, page, filters)
}

export async function obtenerHistorialSolicitudes(ids) {
	if (!ids.length) return {}
	const { data, error } = await supabase.from('historial_solicitudes')
		.select('id, solicitud_id, estado_anterior, estado_nuevo, fecha').in('solicitud_id', ids).order('fecha')
	if (error) throw error
	return data.reduce((groups, item) => { (groups[item.solicitud_id] ||= []).push(item); return groups }, {})
}

export async function obtenerSolicitudDisponiblePorId(id) {
	const { data, error } = await supabase
		.from('solicitudes')
		.select(requestColumns)
		.eq('id', id)
		.maybeSingle()

	if (error) throw error
	if (!data) return null
	const [request] = await enrichAvailableRequests([data])
	return request
}

export async function confirmarAtencion(id) {
	const { error } = await supabase.rpc('confirmar_atencion', { p_solicitud_id: id })
	if (error) throw error
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

export async function obtenerHistorialSolicitud(id) {
	const { data, error } = await supabase
		.from('historial_solicitudes')
		.select('id, estado_anterior, estado_nuevo, fecha')
		.eq('solicitud_id', id)
		.order('fecha', { ascending: true })
	if (error) throw error
	return data
}

export async function crearSolicitud(datos) {
	const data = await createOnce(supabase, 'solicitudes', {
			id: datos.id,
			usuario_id: datos.usuario_id,
			vehiculo_id: datos.vehiculo_id,
			categoria_id: datos.categoria_id,
			titulo: datos.titulo,
			descripcion: datos.descripcion,
			caracteristicas: datos.caracteristicas || null,
			cantidad: datos.cantidad,
		}, requestColumns)
	clearFormDrafts()
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
	clearFormDrafts()
	return data
}

export async function cerrarSolicitud(id, userId) {
	const { data, error } = await supabase
		.from('solicitudes')
		.update({ estado: 'cerrada' })
	.eq('id', id)
		.eq('usuario_id', userId)
		.select(requestColumns)
		.maybeSingle()
	if (error) throw error
	if (!data) throw new Error('La solicitud ya no está abierta o no pertenece a tu cuenta.')
	return data
}

// Active proposals per request (withdrawn ones excluded), for the badges in the request list.
export async function contarPropuestas(ids) {
	if (!ids.length) return {}
	const { data, error } = await supabase.from('propuestas').select('solicitud_id').in('solicitud_id', ids).neq('estado', 'retirada')
	if (error) throw error
	return data.reduce((counts, item) => { counts[item.solicitud_id] = (counts[item.solicitud_id] || 0) + 1; return counts }, {})
}
