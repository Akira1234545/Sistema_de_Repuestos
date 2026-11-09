const definitiveCodes = new Set([
	'PGRST301', 'PGRST302', 'PGRST303', '42501',
	'session_not_found', 'refresh_token_not_found', 'bad_jwt', 'user_not_found', 'user_banned',
])

/** La cuenta ya no existe o está desactivada: hay que cerrar la sesión. */
export function isAccountGoneError(error) {
	const message = String(error?.message || '')
	return message.includes('desactivada') || message.includes('No existe un perfil')
}

/**
 * Errores que sí invalidan el acceso al revalidar la cuenta. Un corte de red,
 * un 5xx o un tiempo de espera agotado no lo son: en esos casos se mantiene el rol.
 */
export function isDefinitiveAuthError(error) {
	if (!error) return false
	if (isAccountGoneError(error)) return true
	if (String(error.message || '').includes('rol válido')) return true
	if (error.status === 401 || error.status === 403) return true
	return definitiveCodes.has(String(error.code || ''))
}
