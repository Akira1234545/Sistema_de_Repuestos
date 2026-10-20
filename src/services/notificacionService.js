import { supabase } from './supabase.js'

const notificationColumns = 'id, tipo, titulo, mensaje, solicitud_id, propuesta_id, leida, fecha_creacion'

function requireSupabase() {
	if (!supabase) throw new Error('Supabase no está configurado. Revisa las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
}

export async function obtenerNotificaciones() {
	requireSupabase()
	const [notificationsResult, unreadResult] = await Promise.all([
		supabase.from('notificaciones')
			.select(notificationColumns)
			.order('fecha_creacion', { ascending: false })
			.limit(50),
		supabase.from('notificaciones')
			.select('id', { count: 'exact', head: true })
			.eq('leida', false),
	])

	if (notificationsResult.error) throw notificationsResult.error
	if (unreadResult.error) throw unreadResult.error
	return { notifications: notificationsResult.data, unreadCount: unreadResult.count || 0 }
}

export async function marcarNotificacionLeida(notificationId) {
	requireSupabase()
	const { data, error } = await supabase.from('notificaciones')
		.update({ leida: true })
		.eq('id', notificationId)
		.select('id, leida')
		.maybeSingle()

	if (error) throw error
	if (!data) throw new Error('La notificación no existe o no pertenece a tu cuenta.')
	return data
}
