import { supabase } from './supabase.js'

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
	if (error) throw error
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
