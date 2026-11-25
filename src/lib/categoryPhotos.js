// Fotos de las categorías principales de la portada (sesión 8). Son fotos libres (ver
// /legal/creditos) guardadas en public/img/categorias/. Se eligen por palabras clave porque la
// categoría viene de la base con un nombre libre; si no hay foto, la tarjeta usa su dibujo.
const RULES = [
	[/fren/, 'frenos'],
	[/suspens|direcc/, 'suspension'],
	[/transmis|embrag/, 'transmision'],
	[/lubric|filtra|aceite/, 'lubricacion'],
	[/combust|inyecc/, 'combustible'],
	[/refrig|radiador/, 'refrigeracion'],
	[/climat|aire/, 'climatizacion'],
	[/escape|emision/, 'escape'],
	[/electr|bater/, 'electrico'],
	[/carrocer|ilumin/, 'carroceria'],
	[/motor/, 'motor'],
]

export function categoryPhoto(name) {
	const text = String(name || '').toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '')
	const match = RULES.find(([pattern]) => pattern.test(text))
	return match ? `/img/categorias/${match[1]}.webp` : null
}
