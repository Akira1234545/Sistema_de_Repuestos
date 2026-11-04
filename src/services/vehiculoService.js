import { catalogNames } from './catalogService.js'
import { supabase } from './supabase.js'
import { clearFormDrafts } from '../lib/formDrafts.js'
import { createOnce } from './createOnce.js'
import { compressImage } from '../lib/images.js'

const vehicleColumns = 'id, tipo_vehiculo_id, marca_id, modelo_id, anio, descripcion, fotos, fecha_creacion'

async function getNamesByIds(table, ids) { return catalogNames(table, ids) }

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

export async function obtenerVehiculosUsuario(userId, page = 0) {
	const { data, error } = await supabase
		.from('vehiculos')
		.select(vehicleColumns)
		.eq('usuario_id', userId)
		.order('fecha_creacion', { ascending: false })
		.order('id').range(page * 25, page * 25 + 25)
	if (error) throw error
	return { items: await enrichVehicles(data.slice(0, 25)), hasMore: data.length > 25 }
}

export async function obtenerVehiculoPorId(id, userId) {
	const { data, error } = await supabase
		.from('vehiculos')
		.select(vehicleColumns)
		.eq('id', id)
		.eq('usuario_id', userId)
		.maybeSingle()
	if (error) throw error
	if (!data) return null
	const { data: requests, error: requestsError } = await supabase.from('solicitudes').select('id').eq('vehiculo_id', id).eq('usuario_id', userId).limit(1)
	if (requestsError) throw requestsError
	return { ...(await enrichVehicles([data]))[0], hasRequests: requests.length > 0 }
}

export async function crearVehiculo(datos) {
	const data = await createOnce(supabase, 'vehiculos', {
			id: datos.id,
			usuario_id: datos.usuario_id,
			tipo_vehiculo_id: datos.tipo_vehiculo_id,
			marca_id: datos.marca_id,
			modelo_id: datos.modelo_id,
			anio: datos.anio,
			descripcion: datos.descripcion || null,
		}, vehicleColumns)
	clearFormDrafts()
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
	clearFormDrafts()
	return data
}

// Requests per vehicle: a vehicle with requests keeps its identity (type, brand, model, year).
export async function contarSolicitudesPorVehiculo(ids) {
	if (!ids.length) return {}
	const { data, error } = await supabase.from('solicitudes').select('vehiculo_id').in('vehiculo_id', ids)
	if (error) throw error
	return data.reduce((counts, item) => { counts[item.vehiculo_id] = (counts[item.vehiculo_id] || 0) + 1; return counts }, {})
}

export async function actualizarNotasVehiculo(id, userId, descripcion) {
	const { data, error } = await supabase.from('vehiculos').update({ descripcion: descripcion?.trim() || null })
		.eq('id', id).eq('usuario_id', userId).select(vehicleColumns).maybeSingle()
	if (error) throw error
	if (!data) throw new Error('El vehículo no existe o no pertenece al usuario autenticado.')
	return data
}

export async function eliminarVehiculo(id, userId, fotos = []) {
	const { data, error } = await supabase.from('vehiculos').delete().eq('id', id).eq('usuario_id', userId).select('id')
	if (error) throw error
	if (!data?.length) throw new Error('No se puede eliminar: el vehículo tiene solicitudes o ya no existe.')
	await borrarFotosStorage(fotos)
}

const PHOTO_MARKER = '/storage/v1/object/public/vehiculos/'
function photoPath(url) {
	const index = String(url).indexOf(PHOTO_MARKER)
	return index === -1 ? null : decodeURIComponent(url.slice(index + PHOTO_MARKER.length))
}
async function borrarFotosStorage(urls) {
	const paths = urls.map(photoPath).filter(Boolean)
	if (paths.length) await supabase.storage.from('vehiculos').remove(paths).catch(() => {})
}

// Compresses and uploads one photo, then saves the new list; rolls the file back if saving fails.
export async function agregarFotoVehiculo(vehicle, userId, file) {
	if ((vehicle.fotos || []).length >= 4) throw new Error('Puedes guardar hasta 4 fotos por vehículo.')
	const blob = await compressImage(file)
	const path = `${userId}/${crypto.randomUUID()}.webp`
	const { error: uploadError } = await supabase.storage.from('vehiculos').upload(path, blob, { contentType: 'image/webp', upsert: false })
	if (uploadError) throw uploadError
	const url = supabase.storage.from('vehiculos').getPublicUrl(path).data.publicUrl
	try {
		return await guardarFotosVehiculo(vehicle.id, userId, [...(vehicle.fotos || []), url])
	} catch (saveError) {
		await borrarFotosStorage([url])
		throw saveError
	}
}

export async function quitarFotoVehiculo(vehicle, userId, url) {
	const updated = await guardarFotosVehiculo(vehicle.id, userId, (vehicle.fotos || []).filter((item) => item !== url))
	await borrarFotosStorage([url])
	return updated
}

async function guardarFotosVehiculo(id, userId, fotos) {
	const { data, error } = await supabase.from('vehiculos').update({ fotos }).eq('id', id).eq('usuario_id', userId).select(vehicleColumns).maybeSingle()
	if (error) throw error
	if (!data) throw new Error('El vehículo no existe o no pertenece al usuario autenticado.')
	return data
}
