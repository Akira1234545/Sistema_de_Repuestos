import { supabase } from './supabase.js'
import { compressImage } from '../lib/images.js'

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
	fotografias_version,
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

export async function obtenerTiendasPublicas(page = 0, search = '', focusId = '') {
	let query = supabase.from('sprint2_tiendas_publicas')
		.select('id, nombre, descripcion, horario, fotografias').order('nombre').order('id')
	if (focusId) query = query.eq('id', focusId)
	if (search.trim()) query = query.ilike('nombre', `%${search.trim()}%`)
	const offset = focusId ? 0 : page * 25
	const { data, error } = await query.range(offset, offset + 25)
	if (error) throw error
	return { items: data.slice(0, 25), hasMore: data.length > 25 }
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
	if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Selecciona fotografías JPEG, PNG o WebP.')
	const blob = await compressImage(file)
	if (blob.size > 5 * 1024 * 1024) throw new Error('La fotografía sigue pesando más de 5 MB. Prueba con otra.')
	const path = `${userId}/${crypto.randomUUID()}.webp`
	const { error: uploadError } = await supabase.storage
		.from('tiendas')
		.upload(path, blob, { cacheControl: '3600', upsert: false, contentType: 'image/webp' })

	if (uploadError) throw uploadError
	const { data } = supabase.storage.from('tiendas').getPublicUrl(path)
	return data.publicUrl
}

export async function actualizarFotografiasTienda(userId, fotografias, version) {
	if (!userId) throw new Error('Inicia sesión antes de actualizar las fotos.')
	const { data, error } = await supabase.rpc('guardar_fotos_tienda', { p_urls: fotografias, p_expected_version: version }).single()

	if (error) throw error
	return data
}

export async function eliminarFotografiaTienda(userId, fotografiaUrl, fotografiasRestantes, version) {
	const store = await actualizarFotografiasTienda(userId, fotografiasRestantes, version)
	const path = storagePathFromUrl(fotografiaUrl)
	if (!path) return { ...store, cleanupPending: false }
	// The versioned update above already detached the photo, so no session can re-attach it:
	// remove the file now and leave the queued job only as a fallback when that fails.
	// Storage reports a delete blocked by policy as success with no removed objects.
	const { data: removed, error } = await supabase.storage.from('tiendas').remove([path])
	if (!error && removed?.length) return { ...store, cleanupPending: false }
	await supabase.rpc('queue_failed_uploads', { p_paths: [path] })
	return { ...store, cleanupPending: true }
}

export async function limpiarSubidasFallidas(urls) {
	const paths = urls.map(storagePathFromUrl).filter(Boolean)
	if (!paths.length) return
	// A failed HTTP response may follow a committed photo update. The worker checks
	// references under a shop lock before deleting; never delete uncertain uploads here.
	const { error } = await supabase.rpc('queue_failed_uploads', { p_paths: paths })
	if (error) throw new Error('No se pudo registrar la limpieza. Contacta con soporte antes de volver a subir fotografías.')
}
