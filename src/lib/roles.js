export const ADMIN_ROLES = ['administrador', 'superAdministrador']

export function isAdminRole(role) {
	return ADMIN_ROLES.includes(role)
}

export function panelPath(role) {
	if (role === 'tienda') return '/tienda'
	if (role === 'cliente') return '/cliente'
	if (isAdminRole(role)) return '/admin'
	return '/login'
}
