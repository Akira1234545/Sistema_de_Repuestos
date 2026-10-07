import { supabase } from './supabase.js'

const storeColumns = `
	id,
	usuario_id,
	nombre,
	descripcion,
	telefono,
	direccion,
	latitud,
	longitud,
	horario,
	fotografias,
	activa,
	fecha_creacion,
	estado,
	motivo_estado
`

export async function obtenerTiendaUsuario(userId) {
	const { data, error } = await supabase
		.from('tiendas')
		.select(storeColumns)
		.eq('usuario_id', userId)
		.maybeSingle()

	if (error) throw error
	return data
}

export async function obtenerTiendasPublicas() {
	const { data, error } = await supabase.from('sprint2_tiendas_publicas')
		.select('id, nombre, descripcion, horario, fotografias').order('nombre')
	if (error) throw error
	return data
}

export async function obtenerCategoriasGestionTienda(userId) {
	const { data: store, error: storeError } = await supabase.from('tiendas')
		.select('id, nombre, estado, activa').eq('usuario_id', userId).maybeSingle()
	if (storeError) throw storeError
	if (!store) return { store: null, categories: [], selectedIds: [], unavailableCount: 0 }

	const [categoriesResult, assignmentsResult] = await Promise.all([
		supabase.from('categorias_repuesto').select('id, nombre, descripcion, categoria_padre_id')
			.eq('activo', true).order('nombre'),
		supabase.from('tienda_categorias').select('categoria_id').eq('tienda_id', store.id),
	])
	if (categoriesResult.error) throw categoriesResult.error
	if (assignmentsResult.error) throw assignmentsResult.error

	const activeIds = new Set(categoriesResult.data.map((category) => category.id))
	const assignedIds = assignmentsResult.data.map((item) => item.categoria_id)
	return {
		store,
		categories: categoriesResult.data,
		selectedIds: assignedIds.filter((id) => activeIds.has(id)),
		unavailableCount: assignedIds.filter((id) => !activeIds.has(id)).length,
	}
}

export async function guardarCategoriasTienda(categoryIds) {
	const { error } = await supabase.rpc('sprint1_update_store_categories', {
		p_category_ids: [...new Set(categoryIds)],
	})
	if (error) throw error
}

export async function crearTienda(userId, datos) {
	const { data, error } = await supabase
		.from('tiendas')
		.insert({
			usuario_id: userId,
			nombre: datos.nombre,
			descripcion: datos.descripcion || null,
			telefono: datos.telefono || null,
			direccion: datos.direccion || null,
			latitud: datos.latitud === '' ? null : datos.latitud,
			longitud: datos.longitud === '' ? null : datos.longitud,
			horario: datos.horario || null,
			fotografias: datos.fotografias || [],
		})
		.select(storeColumns)
		.single()

	if (error) throw error
	return data
}

export async function actualizarTienda(userId, datos) {
	const { data, error } = await supabase
		.from('tiendas')
		.update({
			nombre: datos.nombre,
			descripcion: datos.descripcion || null,
			telefono: datos.telefono || null,
			direccion: datos.direccion || null,
			latitud: datos.latitud === '' ? null : datos.latitud,
			longitud: datos.longitud === '' ? null : datos.longitud,
			horario: datos.horario || null,
		})
		.eq('usuario_id', userId)
		.select(storeColumns)
		.maybeSingle()

	if (error) throw error
	if (!data) throw new Error('La tienda no existe o no pertenece al usuario autenticado.')
	return data
}

function storagePathFromUrl(url) {
	const marker = '/storage/v1/object/public/tiendas/'
	const markerIndex = url.indexOf(marker)
	return markerIndex === -1 ? null : decodeURIComponent(url.slice(markerIndex + marker.length))
}

export async function subirFotografiaTienda(userId, file) {
	const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase()
	const path = `${userId}/${crypto.randomUUID()}-${safeName}`
	const { error: uploadError } = await supabase.storage
		.from('tiendas')
		.upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })

	if (uploadError) throw uploadError
	const { data } = supabase.storage.from('tiendas').getPublicUrl(path)
	return data.publicUrl
}

export async function actualizarFotografiasTienda(userId, fotografias) {
	const { data, error } = await supabase
		.from('tiendas')
		.update({ fotografias })
		.eq('usuario_id', userId)
		.select(storeColumns)
		.single()

	if (error) throw error
	return data
}

export async function eliminarFotografiaTienda(userId, fotografiaUrl, fotografiasRestantes) {
	const path = storagePathFromUrl(fotografiaUrl)
	if (path) {
		const { error: removeError } = await supabase.storage.from('tiendas').remove([path])
		if (removeError) throw removeError
	}

	return actualizarFotografiasTienda(userId, fotografiasRestantes)
}
