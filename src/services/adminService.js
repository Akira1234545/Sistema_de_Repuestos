
import { supabase } from './supabase.js'

function requireSupabase() {
	if (!supabase) {
		throw new Error('Supabase no está configurado. Revisa las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
	}
}

function throwRpcError(error) {
	if (error) {
		throw new Error(error.message || 'La operación administrativa no se pudo completar.')
	}
}

export async function obtenerUsuariosAdministracion() {
	requireSupabase()
	const { data, error } = await supabase.rpc('sprint3_admin_list_users')
	throwRpcError(error)
	return data || []
}

export async function cambiarEstadoUsuario(userId, active) {
	requireSupabase()
	const { error } = await supabase.rpc('sprint3_admin_set_user_active', {
		p_user_id: userId,
		p_active: active,
	})
	throwRpcError(error)
}

export async function obtenerConfiguracionSistema() {
	requireSupabase()
	const { data, error } = await supabase.rpc('sprint3_admin_get_system_settings')
	throwRpcError(error)

	if (!data?.length) {
		throw new Error('No se encontró la configuración del sistema.')
	}

	return data[0]
}

export async function guardarConfiguracionSistema(settings) {
	requireSupabase()
	const { error } = await supabase.rpc('sprint3_admin_update_system_settings', {
		p_support_email: settings.correo_soporte || null,
		p_support_phone: settings.telefono_soporte || null,
		p_maintenance_enabled: settings.mantenimiento_activo,
		p_maintenance_message: settings.mensaje_mantenimiento,
	})
	throwRpcError(error)
}

export async function obtenerCategoriasAdministracion() {
	requireSupabase()
	const { data, error } = await supabase.rpc('sprint3_admin_list_categories')
	throwRpcError(error)
	return data || []
}

export async function guardarCategoriaAdministracion(category) {
	requireSupabase()
	const { data, error } = await supabase.rpc('sprint3_admin_save_category', {
		p_category_id: category.id || null,
		p_name: category.nombre,
		p_description: category.descripcion || null,
		p_parent_id: category.categoria_padre_id || null,
		p_active: category.activo,
	})
	throwRpcError(error)
	return data
}

export async function obtenerSolicitudesAdministracion(filters) {
	requireSupabase()
	const { data, error } = await supabase.rpc('sprint3_admin_list_requests', {
		p_status: filters.estado || null,
		p_category_id: filters.categoriaId || null,
		p_date_from: filters.fechaDesde || null,
		p_date_to: filters.fechaHasta || null,
		p_search: filters.buscar || null,
		p_limit: filters.limit,
		p_offset: filters.offset,
	})
	throwRpcError(error)
	return data || []
}

export async function obtenerPromocionesAdministracion(filters) {
	requireSupabase()
	const { data, error } = await supabase.rpc('sprint3_admin_list_promotions', {
		p_store_id: filters.tiendaId || null,
		p_category_id: filters.categoriaId || null,
		p_status: filters.estado || null,
		p_date_from: filters.fechaDesde || null,
		p_date_to: filters.fechaHasta || null,
		p_search: filters.buscar || null,
		p_limit: filters.limit,
		p_offset: filters.offset,
	})
	throwRpcError(error)
	return data || []
}

export async function obtenerTiendasConPromocionesAdministracion() {
	requireSupabase()
	const { data, error } = await supabase.rpc('sprint3_admin_list_promotion_stores')
	throwRpcError(error)
	return data || []
}

export async function obtenerReportesActividadAdministracion(fechaDesde, fechaHasta) {
	requireSupabase()

	const [reportResult, categoryResult] = await Promise.all([
		supabase.rpc('sprint3_admin_activity_report', {
			p_date_from: fechaDesde,
			p_date_to: fechaHasta,
		}),
		supabase.rpc('sprint3_admin_category_metrics', {
			p_date_from: fechaDesde,
			p_date_to: fechaHasta,
		}),
	])

	throwRpcError(reportResult.error)
	throwRpcError(categoryResult.error)

	if (!reportResult.data || !categoryResult.data) {
		throw new Error('No se recibieron estadísticas del servidor.')
	}

	return {
		...reportResult.data,
		...categoryResult.data,
	}
}
