import { supabase } from './supabase.js'
import { authRedirectUrl } from '../lib/platform.js'

const validRoles = new Set(['cliente', 'tienda', 'administrador', 'superAdministrador'])

export async function obtenerPerfilAutenticado(userId) {
	const { data, error } = await supabase.from('usuarios')
		.select('id, nombre, apellido, telefono, rol, activo')
		.eq('id', userId).maybeSingle()
	if (error) throw error
	if (!data) throw new Error('No existe un perfil asociado en public.usuarios.')
	if (!data.activo) throw new Error('Tu cuenta está desactivada. Contacta al administrador del sistema.')
	if (!validRoles.has(data.rol)) throw new Error('El perfil no tiene un rol válido.')
	return data
}

export async function actualizarMiPerfil({ nombre, apellido, telefono }) {
	const { data, error } = await supabase.rpc('update_my_profile', { new_nombre: nombre, new_apellido: apellido, new_telefono: telefono || null })
	if (error) throw error
	if (!data) throw new Error('Cuenta no disponible para actualizar.')
}

export async function registrarCuenta({ email, password, nombre, apellido, telefono, role }) {
	if (!['cliente', 'tienda'].includes(role)) throw new Error('El registro público solo admite cuentas de cliente o tienda.')
	return supabase.auth.signUp({ email, password, options: { data: { nombre, apellido, telefono, role }, emailRedirectTo: authRedirectUrl('/login') } })
}
