import { supabase } from './supabase.js'

const columns = 'id, tienda_id, categoria_id, titulo, descripcion, marca, precio_anterior, precio_oferta, porcentaje_descuento, caracteristicas, fecha_inicio, fecha_fin, fotografias, estado, fecha_creacion, fecha_actualizacion'

async function enrich(promotions) {
	if (!promotions.length) return []
	const ids = [...new Set(promotions.map((item) => item.categoria_id))]
	const { data: categories, error } = await supabase.from('categorias_repuesto').select('id, nombre').in('id', ids)
	if (error) throw error
	const names = new Map(categories.map((item) => [item.id, item.nombre]))
	return promotions.map((item) => ({ ...item, categoriaNombre: names.get(item.categoria_id) || 'Categoría no disponible' }))
}

export async function obtenerPromocionesDisponibles() {
	const now = new Date().toISOString()
	const { data, error } = await supabase.from('promociones').select(columns).eq('estado', 'activa')
		.lte('fecha_inicio', now).gt('fecha_fin', now).order('fecha_fin', { ascending: true })
	if (error) throw error
	return enrich(data)
}

export async function obtenerPromocion(id) {
	const { data, error } = await supabase.from('promociones').select(columns).eq('id', id).maybeSingle()
	if (error) throw error
	if (!data) return null
	const [item] = await enrich([data])
	return item
}

export async function obtenerPromocionesDeMiTienda(userId) {
	const { data: store, error: storeError } = await supabase.from('tiendas').select('id').eq('usuario_id', userId).maybeSingle()
	if (storeError) throw storeError
	if (!store) return []
	const { data, error } = await supabase.from('promociones').select(columns).eq('tienda_id', store.id).order('fecha_creacion', { ascending: false })
	if (error) throw error
	return enrich(data)
}

export async function crearPromocion(storeId, values) {
	const { data, error } = await supabase.from('promociones').insert({
		tienda_id: storeId, categoria_id: values.categoria_id, titulo: values.titulo.trim(),
		descripcion: values.descripcion.trim() || null, marca: values.marca.trim() || null,
		precio_anterior: Number(values.precio_anterior), precio_oferta: Number(values.precio_oferta),
		caracteristicas: values.caracteristicas.trim() || null,
		fecha_inicio: new Date(values.fecha_inicio).toISOString(), fecha_fin: new Date(values.fecha_fin).toISOString(),
	}).select(columns).single()
	if (error) throw error
	return data
}

export async function actualizarPromocion(id, values) {
	const { data, error } = await supabase.from('promociones').update({
		categoria_id: values.categoria_id, titulo: values.titulo.trim(),
		descripcion: values.descripcion.trim() || null, marca: values.marca.trim() || null,
		precio_anterior: Number(values.precio_anterior), precio_oferta: Number(values.precio_oferta),
		caracteristicas: values.caracteristicas.trim() || null,
		fecha_inicio: new Date(values.fecha_inicio).toISOString(), fecha_fin: new Date(values.fecha_fin).toISOString(),
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
