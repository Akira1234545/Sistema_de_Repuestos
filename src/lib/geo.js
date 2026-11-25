// Coordenadas válidas para mostrar un mapa (sesión 8). 0,0 se descarta: es el valor por defecto
// de un formulario vacío, no una tienda real.
export function validCoordinates(lat, lng) {
	const latitude = Number(lat)
	const longitude = Number(lng)
	return lat !== null && lat !== undefined && lat !== '' && lng !== null && lng !== undefined && lng !== ''
		&& Number.isFinite(latitude) && Number.isFinite(longitude)
		&& Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && !(latitude === 0 && longitude === 0)
}
