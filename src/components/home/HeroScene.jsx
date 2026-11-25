import BrakeAssembly from './BrakeAssembly.jsx'

// Escena del hero en capas. Cada capa lleva `data-depth`: cuanto mayor, más rápido
// se desplaza con el scroll (parallax). Sin JavaScript o con movimiento reducido es
// una composición estática completa. Decorativa: el texto del hero no depende de ella.
// Las tarjetas ilustran el flujo (solicitud → propuesta → reseña) sin cifras ni nombres.
export default function HeroScene() {
	return <div className="hero-scene" aria-hidden="true">
		<div className="hero-layer hero-layer-glow" data-depth="0.1" />
		<div className="hero-layer hero-layer-grid" data-depth="0.2" />
		<svg className="hero-layer hero-layer-road" data-depth="0.35" viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice" focusable="false">
			<defs>
				<linearGradient id="hero-road-fade" x1="0" y1="0" x2="0" y2="1">
					<stop className="hero-road-stop-0" offset="0" />
					<stop className="hero-road-stop-1" offset=".55" />
					<stop className="hero-road-stop-2" offset="1" />
				</linearGradient>
			</defs>
			<path d="M960 0h120l560 420H420Z" fill="url(#hero-road-fade)" />
			<path d="M960 0 420 420M1080 0l560 420" className="hero-road-edge" />
			<path className="hero-road-lane" d="M1020 8l10 412" />
		</svg>
		<svg className="hero-layer hero-layer-chevrons" data-depth="0.55" viewBox="0 0 520 400" focusable="false">
			<path d="M40 30l170 170L40 370" className="hero-chevron hero-chevron-signal" />
			<path d="M240 30l170 170-170 170" className="hero-chevron hero-chevron-highlight" />
		</svg>
		<div className="hero-layer hero-layer-brake" data-depth="0.8">
			<BrakeAssembly idPrefix="hero" className="hero-rotor" />
		</div>
		<div className="hero-layer hero-layer-cards" data-depth="1.25">
			<div className="hero-card hero-card-1">
				<span className="hero-card-kicker">Solicitud publicada</span>
				<strong>Pastillas de freno delanteras</strong>
				<span className="hero-card-meta">Frenos · 2 unidades</span>
			</div>
			<div className="hero-card hero-card-2">
				<span className="hero-card-kicker">Propuesta de tienda</span>
				<strong>Precio total, marca y garantía</strong>
				<span className="hero-card-status">Enviada</span>
			</div>
			<div className="hero-card hero-card-3">
				<span className="hero-card-stars">★★★★★</span>
				<strong>Atención confirmada</strong>
			</div>
		</div>
	</div>
}
