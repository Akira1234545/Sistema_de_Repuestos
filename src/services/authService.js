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

export async function registrarCuenta({ email, password, nombre, apellido, telefono, role, legal }) {
	if (!['cliente', 'tienda'].includes(role)) throw new Error('El registro público solo admite cuentas de cliente o tienda.')
	if (!legal?.version) throw new Error('Debes aceptar los términos y la política de privacidad.')
	// Sesión 8: la aceptación queda como evidencia en los metadatos de la cuenta (versión, documentos y fecha).
	const aceptacion = { version: legal.version, documentos: legal.documentos, fecha: new Date().toISOString() }
	return supabase.auth.signUp({ email, password, options: { data: { nombre, apellido, telefono, role, aceptacion_legal: aceptacion }, emailRedirectTo: authRedirectUrl('/login') } })
}
