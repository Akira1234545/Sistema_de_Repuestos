export const ADMIN_ROLES = ['administrador', 'superAdministrador']

export const ROLE_LABELS = { cliente: 'Cliente', tienda: 'Tienda', administrador: 'Administrador', superAdministrador: 'Superadministrador' }

export function isAdminRole(role) {
	return ADMIN_ROLES.includes(role)
}

export function panelPath(role) {
	if (role === 'tienda') return '/tienda'
	if (role === 'cliente') return '/cliente'
	if (isAdminRole(role)) return '/admin'
	return '/login'
}
