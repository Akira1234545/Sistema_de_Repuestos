import { supabase } from './supabase.js'
import { clearFormDrafts } from '../lib/formDrafts.js'

const proposalColumns = 'id, solicitud_id, tienda_id, precio, marca, disponibilidad, caracteristicas, garantia, observaciones, estado, fecha_creacion, fecha_actualizacion'

export async function obtenerPropuestasDeSolicitud(solicitudId) {
	const { data, error } = await supabase
		.from('propuestas')
		.select(proposalColumns)
		.eq('solicitud_id', solicitudId)
		.order('fecha_creacion', { ascending: true })
	if (error) throw error
	const storeIds = [...new Set(data.map((proposal) => proposal.tienda_id))]
	if (!storeIds.length) return data.map((proposal) => ({ ...proposal, tienda: null }))
	const [profilesResult, contactsResult] = await Promise.all([
		supabase.from('sprint2_tiendas_publicas').select('id, nombre, descripcion, horario, fotografias').in('id', storeIds),
		supabase.from('sprint2_tienda_contacto').select('id, nombre, telefono, direccion, latitud, longitud').in('id', storeIds),
	])
	if (profilesResult.error) throw profilesResult.error
	if (contactsResult.error) throw contactsResult.error
	const stores = new Map(profilesResult.data.map((store) => [store.id, store]))
	for (const store of contactsResult.data) stores.set(store.id, { ...stores.get(store.id), ...store })
	return data.map((proposal) => ({ ...proposal, tienda: stores.get(proposal.tienda_id) || null }))
}

export async function obtenerMiPropuesta(solicitudId, userId) {
	const { data: store, error: storeError } = await supabase.from('tiendas').select('id').eq('usuario_id', userId).maybeSingle()
	if (storeError) throw storeError
	if (!store) return null
	const { data, error } = await supabase.from('propuestas').select(proposalColumns)
		.eq('solicitud_id', solicitudId).eq('tienda_id', store.id).maybeSingle()
	if (error) throw error
	return data
}

export async function crearPropuesta(values) {
	const { data, error } = await supabase.rpc('sprint2_crear_propuesta', {
		p_solicitud_id: values.solicitud_id,
		p_precio: values.precio,
		p_marca: values.marca,
		p_disponibilidad: values.disponibilidad,
		p_caracteristicas: values.caracteristicas || null,
		p_garantia: values.garantia || null,
		p_observaciones: values.observaciones || null,
	})
	if (error?.code === '23505' && values.userId) {
		const existing = await obtenerMiPropuesta(values.solicitud_id, values.userId)
		if (existing && Number(existing.precio) === Number(values.precio) && ['marca','disponibilidad','caracteristicas','garantia','observaciones'].every(key => (existing[key] || '').trim() === (values[key] || '').trim())) {
			clearFormDrafts(); return existing.id
		}
	}
	if (error) throw error
	clearFormDrafts()
	return data
}

export async function seleccionarPropuesta(solicitudId, propuestaId) {
	const { data, error } = await supabase.rpc('sprint2_seleccionar_propuesta', {
		p_solicitud_id: solicitudId,
		p_propuesta_id: propuestaId,
	})
	if (error) throw error
	return data
}

export async function retirarPropuesta(id) {
	const { error } = await supabase.rpc('retirar_propuesta', { p_propuesta_id: id })
	if (error) throw error
}

export async function obtenerMisPropuestas(userId, page = 0) {
	const { data: store, error: storeError } = await supabase.from('tiendas').select('id').eq('usuario_id', userId).maybeSingle()
	if (storeError) throw storeError
	if (!store) return { items: [], hasMore: false }
	const { data, error } = await supabase.from('propuestas')
		.select(`${proposalColumns}, solicitud:solicitudes!propuestas_solicitud_id_fkey(id,titulo,estado,cantidad)`)
		.eq('tienda_id', store.id).order('fecha_creacion', { ascending: false }).order('id').range(page * 25, page * 25 + 25)
	if (error) throw error
	return { items: data.slice(0, 25), hasMore: data.length > 25 }
}

// Estado de la propuesta de esta tienda para cada solicitud de la lista (solo las que ya respondió).
export async function obtenerEstadoRespuestas(storeId, solicitudIds) {
	const ids = [...new Set(solicitudIds)].filter(Boolean)
	if (!storeId || ids.length === 0) return {}
	const { data, error } = await supabase.from('propuestas').select('solicitud_id, estado')
		.eq('tienda_id', storeId).in('solicitud_id', ids)
	if (error) throw error
	return Object.fromEntries(data.map((item) => [item.solicitud_id, item.estado]))
}
