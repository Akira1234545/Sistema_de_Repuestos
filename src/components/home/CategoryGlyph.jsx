// Ilustraciones propias (trazo de 1,6 en una rejilla de 48) para las tarjetas de categorías.
// La categoría viene de la base de datos con un nombre libre: se elige el dibujo por palabras clave
// y, si no hay coincidencia, se usa la llave. Puramente decorativas.
const GLYPHS = {
	brake: <><circle cx="24" cy="24" r="17" /><circle cx="24" cy="24" r="6" /><circle cx="24" cy="24" r="11.5" strokeDasharray="2 4.2" /><path d="M33 9.5c5 2.6 8.3 7.5 8.8 13" strokeWidth="5" stroke="var(--glyph-accent)" /></>,
	engine: <><path d="M8 18h6l3-4h12l3 4h6v6h3v-3h3v12h-3v-3h-3v8H17l-4-4H8Z" /><path d="M18 14v-4h10v4M14 24h4M30 24h4" /></>,
	spring: <><path d="M14 8h20M14 40h20" /><path d="M16 12l16 4-16 4 16 4-16 4 16 4-16 4" stroke="var(--glyph-accent)" /></>,
	gear: <><path d="M24 6l3 5 6-1 1 6 5 3-3 5 3 5-5 3-1 6-6-1-3 5-3-5-6 1-1-6-5-3 3-5-3-5 5-3 1-6 6 1Z" /><circle cx="24" cy="24" r="6" stroke="var(--glyph-accent)" /></>,
	bolt: <><rect x="7" y="14" width="34" height="24" rx="3" /><path d="M13 14v-4h6v4M29 14v-4h6v4" /><path d="M25 18l-6 9h7l-4 8" stroke="var(--glyph-accent)" /></>,
	body: <><path d="M5 30v-6l5-2 6-8h15l8 8 4 1v7h-4" /><path d="M14 30h17" /><circle cx="10" cy="31" r="4" /><circle cx="35" cy="31" r="4" /><path d="M18 15l-3 7h20" stroke="var(--glyph-accent)" /></>,
	drop: <><path d="M24 6c6 9 12 15 12 22a12 12 0 0 1-24 0c0-7 6-13 12-22Z" /><path d="M19 30a6 6 0 0 0 5 5" stroke="var(--glyph-accent)" /></>,
	tire: <><circle cx="24" cy="24" r="18" /><circle cx="24" cy="24" r="9" stroke="var(--glyph-accent)" /><path d="M24 6v9M24 33v9M6 24h9M33 24h9M11 11l6 6M31 31l6 6M37 11l-6 6M17 31l-6 6" strokeDasharray="2 3" /></>,
	cooling: <><rect x="8" y="10" width="32" height="28" rx="3" /><path d="M14 10v28M20 10v28M26 10v28M32 10v28" /><path d="M8 18h32" stroke="var(--glyph-accent)" /></>,
	exhaust: <><path d="M4 28h14l6-6h10" /><rect x="30" y="16" width="14" height="12" rx="6" /><path d="M8 34c2-2 4 2 6 0s4 2 6 0" stroke="var(--glyph-accent)" /></>,
	steering: <><circle cx="24" cy="24" r="17" /><circle cx="24" cy="24" r="4" /><path d="M7.5 21c6-3 11-3 12.5 1M40.5 21c-6-3-11-3-12.5 1M24 28v13" stroke="var(--glyph-accent)" /></>,
	light: <><path d="M12 14h10a10 10 0 0 1 0 20H12Z" /><path d="M30 16l10-3M31 24h11M30 32l10 3" stroke="var(--glyph-accent)" /></>,
	filter: <><path d="M8 10h32l-12 14v14l-8-4V24Z" /><path d="M14 16h20" stroke="var(--glyph-accent)" /></>,
	wrench: <><path d="M30 6a9 9 0 0 0-8 12L8 32a4 4 0 0 0 6 6l14-14a9 9 0 0 0 12-8l-6 2-4-4 2-6a9 9 0 0 0-2-2Z" /><circle cx="11" cy="35" r="1" stroke="var(--glyph-accent)" /></>,
}

const RULES = [
	[/fren|pastilla|disco|zapata/, 'brake'],
	[/suspens|amortigu|resorte|muelle/, 'spring'],
	[/transmis|embrag|caja|cambio|diferencial/, 'gear'],
	[/filtro/, 'filter'],
	[/aceite|lubric|fluido|liquido/, 'drop'],
	[/motor|culata|piston|correa|distribu/, 'engine'],
	[/bater|electr|alternador|arranque/, 'bolt'],
	[/luz|luces|faro|ilumin|optic/, 'light'],
	[/carrocer|parachoq|espejo|puerta|capo|vidrio|parabris/, 'body'],
	[/neumat|llanta|rueda|aro/, 'tire'],
	[/refriger|radiador|enfria|termost/, 'cooling'],
	[/escape|silenciador|catalizador/, 'exhaust'],
	[/direcc|volante|rotula/, 'steering'],
]

function normalize(text) {
	return String(text || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function glyphFor(name) {
	const value = normalize(name)
	return RULES.find(([pattern]) => pattern.test(value))?.[1] || 'wrench'
}

export default function CategoryGlyph({ name, className = '' }) {
	return <svg className={`category-glyph ${className}`} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
		{GLYPHS[glyphFor(name)]}
	</svg>
}
