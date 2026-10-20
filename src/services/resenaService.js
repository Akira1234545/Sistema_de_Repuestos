import { supabase } from './supabase.js'

const privateReviewColumns = 'id, usuario_id, tienda_id, propuesta_id, calificacion, comentario, fecha_creacion'
const publicReviewColumns = 'id, tienda_id, calificacion, comentario, fecha_creacion'
const storeReviewColumns = 'id, tienda_id, calificacion, comentario, fecha_creacion, nombre_cliente, apellido_cliente'

export async function obtenerResenasRecibidas() {
	const { data: { user }, error: authError } = await supabase.auth.getUser()
	if (authError) throw authError
	if (!user) throw new Error('Inicia sesión con tu cuenta de tienda para consultar las reseñas.')

	const { data: store, error: storeError } = await supabase
		.from('tiendas')
		.select('id, nombre')
		.eq('usuario_id', user.id)
		.maybeSingle()

	if (storeError) throw storeError
	if (!store) return { store: null, reviews: [] }

	const { data, error } = await supabase
		.from('sprint3_resenas_tienda')
		.select(storeReviewColumns)
		.eq('tienda_id', store.id)
		.order('fecha_creacion', { ascending: false })
		.order('id', { ascending: true })

	if (error?.code === 'PGRST205' && error.message.includes('sprint3_resenas_tienda')) {
		throw new Error('La vista de reseñas con nombres no está disponible en Supabase. Aplica database/migrations/20261021_resenas_nombre_cliente.sql después de 20261020_resenas_tienda_propietaria.sql y vuelve a cargar la página.')
	}
	if (error) throw error
	return { store, reviews: data }
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
	if (uniqueStoreIds.length === 0) return []

	const reviews = []
	const pageSize = 500
	for (let offset = 0; ; offset += pageSize) {
		const { data, error } = await supabase
			.from('resenas')
			.select(publicReviewColumns)
			.in('tienda_id', uniqueStoreIds)
			.order('fecha_creacion', { ascending: false })
			.order('id', { ascending: true })
			.range(offset, offset + pageSize - 1)

		if (error) throw error
		reviews.push(...data)
		if (data.length < pageSize) return reviews
	}
}
