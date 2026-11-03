import { supabase } from './supabase.js'
import { createBatchLookup } from '../lib/batchLookup.js'

const favorites = {
	tienda: { table: 'favoritos_tienda', column: 'tienda_id' },
	solicitud: { table: 'favoritos_solicitud', column: 'solicitud_id' },
	promocion: { table: 'favoritos_promocion', column: 'promocion_id' },
}

function getTarget(type) {
	const target = favorites[type]
	if (!target) throw new Error('Tipo de favorito no válido.')
	return target
}

const lookup = createBatchLookup(async (group, ids) => {
	const [type, userId] = group.split(':')
	const { table, column } = getTarget(type)
	const found = new Set()
	for (let start = 0; start < ids.length; start += 100) {
		const { data, error } = await supabase.from(table).select(column).eq('usuario_id', userId).in(column, ids.slice(start, start + 100))
		if (error) throw error
		for (const item of data) found.add(item[column])
	}
	return found
})
export function obtenerFavorito(type, itemId, userId) {
	return lookup(`${type}:${userId}`, itemId)
}

export async function agregarFavorito(type, itemId, userId) {
	const { table, column } = getTarget(type)
	const { error } = await supabase.from(table).insert({ usuario_id: userId, [column]: itemId })
	if (error && error.code !== '23505') throw error
}

export async function quitarFavorito(type, itemId, userId) {
	const { table, column } = getTarget(type)
	const { error } = await supabase.from(table).delete().eq('usuario_id', userId).eq(column, itemId)
	if (error) throw error
}

export async function obtenerFavoritosUsuario(userId, page = 0) {
	const results = await Promise.all([
		supabase.from('favoritos_tienda').select('id, tienda_id, fecha_creacion').eq('usuario_id', userId).order('fecha_creacion', { ascending: false }).order('id').range(page * 25, page * 25 + 25),
		supabase.from('favoritos_solicitud').select('id, solicitud_id, fecha_creacion, item:solicitudes(id, titulo, estado)').eq('usuario_id', userId).order('fecha_creacion', { ascending: false }).order('id').range(page * 25, page * 25 + 25),
		supabase.from('favoritos_promocion').select('id, promocion_id, fecha_creacion, item:promociones(id, titulo, precio_oferta, fecha_fin)').eq('usuario_id', userId).order('fecha_creacion', { ascending: false }).order('id').range(page * 25, page * 25 + 25),
	])
	for (const { error } of results) if (error) throw error
	const hasMore = results.some(result => result.data.length > 25)
	for (const result of results) result.data = result.data.slice(0, 25)
	const storeIds = results[0].data.map((favorite) => favorite.tienda_id)
	let stores = new Map()
	if (storeIds.length) {
		const [profilesResult, contactsResult] = await Promise.all([
			supabase.from('sprint2_tiendas_publicas').select('id, nombre, descripcion, horario, fotografias').in('id', storeIds),
			supabase.from('sprint2_tienda_contacto').select('id, nombre, telefono, direccion').in('id', storeIds),
		])
		if (profilesResult.error) throw profilesResult.error
		if (contactsResult.error) throw contactsResult.error
		stores = new Map(profilesResult.data.map((store) => [store.id, store]))
		for (const store of contactsResult.data) stores.set(store.id, { ...stores.get(store.id), ...store })
	}
	return { hasMore, items: results.flatMap(({ data }, index) => data.map((item) => ({
		...item,
		type: ['tienda', 'solicitud', 'promocion'][index],
		...(index === 0 ? { item: stores.get(item.tienda_id) || null } : {}),
	}))) }
}
