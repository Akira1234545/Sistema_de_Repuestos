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
			.order('leida', { ascending: true })
			.order('fecha_creacion', { ascending: false })
			.order('id')
			.limit(50),
		supabase.from('notificaciones')
			.select('id', { count: 'exact', head: true })
			.eq('leida', false),
	])

	if (notificationsResult.error) throw notificationsResult.error
	if (unreadResult.error) throw unreadResult.error
	return { notifications: notificationsResult.data, unreadCount: unreadResult.count || 0 }
}

// Calls onInsert with each new notification for this account as soon as it is created.
// Realtime enforces the table's RLS, so only the account's own rows arrive.
export function suscribirNotificaciones(userId, onInsert) {
	if (!supabase || !userId) return () => {}
	const channel = supabase.channel(`notificaciones:${userId}`)
		.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${userId}` }, (payload) => onInsert(payload.new))
		.subscribe()
	return () => { void supabase.removeChannel(channel) }
}

export async function marcarNotificacionLeida(notificationId) {
	requireSupabase()
	const { error } = await supabase.rpc('marcar_notificaciones_leidas', { p_ids: [notificationId] })

	if (error) throw error
	return { id: notificationId, leida: true }
}

export async function marcarTodasLeidas() {
	requireSupabase()
	const { error } = await supabase.rpc('marcar_notificaciones_leidas', { p_ids: null })
	if (error) throw error
}
