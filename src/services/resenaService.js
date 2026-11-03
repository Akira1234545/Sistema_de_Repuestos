import { supabase } from './supabase.js'

const privateReviewColumns = 'id, usuario_id, tienda_id, propuesta_id, calificacion, comentario, fecha_creacion'
const publicReviewColumns = 'id, tienda_id, calificacion, comentario, fecha_creacion'

export async function obtenerResenasRecibidas(page = 0) {
 const { data, error } = await supabase.rpc('my_review_page', { p_offset: page * 25, p_limit: 25 })
 if (error) throw error
 return data
}

export async function obtenerResenaDePropuesta(propuestaId) {
	const { data, error } = await supabase
		.from('resenas')
		.select(privateReviewColumns)
		.eq('propuesta_id', propuestaId)
		.maybeSingle()

	if (error) throw error
	return data
}

export async function crearResena({ usuarioId, tiendaId, propuestaId, calificacion, comentario }) {
	const { data, error } = await supabase
		.from('resenas')
		.insert({
			usuario_id: usuarioId,
			tienda_id: tiendaId,
			propuesta_id: propuestaId,
			calificacion,
			comentario: comentario.trim() || null,
		})
		.select(privateReviewColumns)
		.single()

	if (error) throw error
	return data
}

export async function obtenerResenasPublicasDeTiendas(tiendaIds) {
	const uniqueStoreIds = [...new Set(tiendaIds)]
	if (uniqueStoreIds.length === 0) return { reviews: [], summaries: {} }
	const { data, error } = await supabase.rpc('public_store_reviews', { p_store_ids: uniqueStoreIds })
	if (error) throw error
	return { reviews: data.flatMap(item => item.resenas), summaries: Object.fromEntries(data.map(item => [item.tienda_id, { total: item.total, promedio: item.promedio }])) }
}

export async function obtenerResenasPublicasTienda(storeId, offset) {
	const { data, error } = await supabase.from('resenas_publicas').select(publicReviewColumns)
		.eq('tienda_id', storeId).order('fecha_creacion', { ascending: false }).order('id').range(offset, offset + 4)
	if (error) throw error
	return data
}
