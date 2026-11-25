// Enlaces de la portada, el encabezado público y el pie según el rol (E23).
// Sin sesión no se enlaza a rutas protegidas (promociones, panel de cliente):
// llevarían al login sin explicar por qué. Las cuentas tienda y admin no reciben
// enlaces a /cliente/*, que les mostraría «Acceso no disponible».
import { isAdminRole, panelPath } from './roles.js'

const HAS_PROMOTIONS = new Set(['cliente', 'tienda'])

export function canSeePromotions(role) {
	return HAS_PROMOTIONS.has(role)
}

// Enlaces del menú principal (sin contar el acceso ni el cierre de sesión).
export function publicNavLinks(role, signedIn) {
	const links = [
		{ to: '/#categorias', label: 'Categorías', hash: true },
		{ to: '/#como-funciona', label: 'Cómo funciona', hash: true },
		{ to: '/tiendas', label: 'Tiendas' },
	]
	if (signedIn && canSeePromotions(role)) links.push({ to: '/promociones', label: 'Promociones' })
	if (signedIn && role) links.push({ to: panelPath(role), label: isAdminRole(role) ? 'Administración' : 'Mi panel' })
	return links
}

// Llamadas a la acción del hero: principal y secundaria.
export function heroActions(role, signedIn) {
	if (!signedIn || !role) return {
		primary: { to: '/register?role=cliente', label: 'Publicar mi primera solicitud' },
		secondary: { to: '/tiendas', label: 'Ver tiendas aprobadas' },
	}
	if (role === 'cliente') return {
		primary: { to: '/cliente/solicitudes/crear', label: 'Publicar una solicitud' },
		secondary: { to: '/cliente', label: 'Ir a mi panel' },
	}
	if (role === 'tienda') return {
		primary: { to: '/tienda/solicitudes', label: 'Ver solicitudes disponibles' },
		secondary: { to: '/tienda', label: 'Ir a mi panel' },
	}
	return {
		primary: { to: panelPath(role), label: 'Ir a administración' },
		secondary: { to: '/tiendas', label: 'Ver tiendas aprobadas' },
	}
}

// Destino de una tarjeta de categoría. `null` = la tarjeta no es un enlace (admin).
export function categoryLink(role, signedIn, categoryId) {
	if (!signedIn || !role) return { to: '/register?role=cliente', action: 'Crear cuenta y pedir' }
	if (role === 'cliente') return { to: `/cliente/solicitudes/crear?categoria=${encodeURIComponent(categoryId)}`, action: 'Pedir un repuesto' }
	if (role === 'tienda') return { to: '/tienda/categorias', action: 'Atender esta categoría' }
	return null
}

// Enlace a una tienda del catálogo: el cliente la ve dentro de su panel.
export function storeLink(role, storeId) {
	return `${role === 'cliente' ? '/cliente/tiendas' : '/tiendas'}#${storeId}`
}

// Las dos rutas de la llamada final (persona que busca un repuesto / tienda).
export function finalPaths(role, signedIn) {
	const client = !signedIn
		? { to: '/register?role=cliente', label: 'Crear cuenta de cliente' }
		: role === 'cliente' ? { to: '/cliente/solicitudes/crear', label: 'Publicar una solicitud' } : null
	const store = !signedIn
		? { to: '/register?role=tienda', label: 'Registrar mi tienda' }
		: role === 'tienda' ? { to: '/tienda', label: 'Administrar mi tienda' } : null
	return { client, store }
}

// Categorías principales primero (con el número de subcategorías activas). Si no hay jerarquía, todas.
export function landingCategories(categories, limit = 12) {
	const list = Array.isArray(categories) ? categories : []
	const parents = list.filter((category) => !category.categoria_padre_id)
	const children = new Map()
	for (const category of list) {
		if (category.categoria_padre_id) children.set(category.categoria_padre_id, (children.get(category.categoria_padre_id) || 0) + 1)
	}
	const base = parents.length ? parents : list
	return base.slice(0, limit).map((category) => ({ ...category, subcategorias: children.get(category.id) || 0 }))
}

// Reseñas con comentario, las más recientes primero.
export function featuredReviews(reviews, storesById, limit = 6) {
	return (Array.isArray(reviews) ? reviews : [])
		.filter((review) => String(review.comentario || '').trim() && storesById.has(review.tienda_id))
		.sort((a, b) => String(b.fecha_creacion).localeCompare(String(a.fecha_creacion)))
		.slice(0, limit)
		.map((review) => ({ ...review, tienda: storesById.get(review.tienda_id) }))
}
