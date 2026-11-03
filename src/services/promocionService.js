import { catalogNames } from './catalogService.js'
import { supabase } from './supabase.js'
import { createOnce } from './createOnce.js'

const columns = 'id, tienda_id, categoria_id, titulo, descripcion, marca, precio_anterior, precio_oferta, porcentaje_descuento, caracteristicas, fecha_inicio, fecha_fin, fotografias, estado, fecha_creacion, fecha_actualizacion'

async function enrich(promotions) {
	if (!promotions.length) return []
	const ids = [...new Set(promotions.map((item) => item.categoria_id))]
	const names = await catalogNames('categorias_repuesto', ids)
	return promotions.map((item) => ({ ...item, categoriaNombre: names.get(item.categoria_id) || 'Categoría no disponible' }))
}

export async function obtenerPromocionesDisponibles(page = 0, search = '') {
	const { data, error } = await supabase.rpc('promotion_page', { p_owner: false, p_search: search || null, p_offset: page * 25, p_limit: 26 }).select(columns)
	if (error) throw error
	return { items: await enrich(data.slice(0, 25)), hasMore: data.length > 25 }
}

export async function obtenerPromocion(id) {
	const { data, error } = await supabase.from('promociones').select(columns).eq('id', id).maybeSingle()
	if (error) throw error
	if (!data) return null
	const [item] = await enrich([data])
	const { data: store, error: storeError } = await supabase.from('sprint2_tiendas_publicas')
		.select('id, nombre, telefono').eq('id', data.tienda_id).maybeSingle()
	if (storeError) throw storeError
	return { ...item, tienda: store }
}

export async function obtenerPromocionesDeMiTienda(userId, page = 0) {
	if (!userId) throw new Error('Inicia sesión antes de consultar promociones.')
	const { data, error } = await supabase.rpc('promotion_page', { p_owner: true, p_offset: page * 25, p_limit: 26 }).select(columns)
	if (error) throw error
	return { items: await enrich(data.slice(0, 25)), hasMore: data.length > 25 }
}

export async function crearPromocion(storeId, values) {
	const data = await createOnce(supabase, 'promociones', {
		id: values.id,
		tienda_id: storeId, categoria_id: values.categoria_id, titulo: values.titulo.trim(),
		descripcion: values.descripcion.trim() || null, marca: values.marca.trim() || null,
		precio_anterior: Number(values.precio_anterior), precio_oferta: Number(values.precio_oferta),
		caracteristicas: values.caracteristicas.trim() || null,
		fecha_inicio: new Date(`${values.fecha_inicio}-04:00`).toISOString(), fecha_fin: new Date(`${values.fecha_fin}-04:00`).toISOString(),
	}, columns, 'tienda_id')
	return data
}

export async function actualizarPromocion(id, values) {
	const { data, error } = await supabase.from('promociones').update({
		categoria_id: values.categoria_id, titulo: values.titulo.trim(),
		descripcion: values.descripcion.trim() || null, marca: values.marca.trim() || null,
		precio_anterior: Number(values.precio_anterior), precio_oferta: Number(values.precio_oferta),
		caracteristicas: values.caracteristicas.trim() || null,
		fecha_inicio: new Date(`${values.fecha_inicio}-04:00`).toISOString(), fecha_fin: new Date(`${values.fecha_fin}-04:00`).toISOString(),
	}).eq('id', id).select(columns).maybeSingle()
	if (error) throw error
	if (!data) throw new Error('No se encontró la promoción de tu tienda.')
	return data
}

export async function cambiarEstadoPromocion(id, estado) {
	const { data, error } = await supabase.from('promociones').update({ estado }).eq('id', id).select(columns).maybeSingle()
	if (error) throw error
	if (!data) throw new Error('No se encontró la promoción de tu tienda.')
	return data
}
