import { useRef, useState } from 'react'

// Escena interactiva del lado izquierdo de acceso y registro (sesión 8).
// Se elige auto, moto o camión; las ruedas giran, la carretera avanza y la escena se inclina con
// el puntero. Sin datos inventados: las etiquetas son categorías reales de repuestos.
// Con prefers-reduced-motion todo queda quieto (ver pages.css).

const VEHICLES = {
	auto: { label: 'Auto', tags: ['Frenos', 'Suspensión', 'Motor'] },
	moto: { label: 'Moto', tags: ['Transmisión', 'Frenos', 'Eléctrico'] },
	camion: { label: 'Camión', tags: ['Neumáticos', 'Embrague', 'Filtros'] },
}

function Wheel({ cx, cy, r }) {
	return <g className="auth-wheel" style={{ transformOrigin: `${cx}px ${cy}px` }}>
		<circle cx={cx} cy={cy} r={r} className="auth-tire" />
		<circle cx={cx} cy={cy} r={r * .58} className="auth-rim" />
		{[0, 60, 120].map((angle) => <line key={angle} className="auth-spoke"
			x1={cx + Math.cos(angle * Math.PI / 180) * r * .52} y1={cy + Math.sin(angle * Math.PI / 180) * r * .52}
			x2={cx - Math.cos(angle * Math.PI / 180) * r * .52} y2={cy - Math.sin(angle * Math.PI / 180) * r * .52} />)}
		<circle cx={cx} cy={cy} r={r * .14} className="auth-hub" />
	</g>
}

function Car() {
	return <g>
		<path className="auth-body" d="M60 196c0-20 12-30 34-34l56-10 46-40c10-8 20-12 34-12h96c16 0 28 6 38 16l36 38 66 10c22 4 34 16 34 34v20c0 8-6 14-14 14H74c-8 0-14-6-14-14z" />
		<path className="auth-glass" d="M162 150l40-34c6-5 12-8 20-8h46v42zM286 108h48c10 0 17 4 24 11l30 31H286z" />
		<rect className="auth-light" x="440" y="182" width="22" height="10" rx="4" />
		<rect className="auth-light is-rear" x="64" y="182" width="16" height="10" rx="4" />
		<Wheel cx={150} cy={230} r={34} /><Wheel cx={388} cy={230} r={34} />
	</g>
}

function Moto() {
	return <g>
		<path className="auth-frame" d="M170 226l70-70h70l50 70M240 156l-20 70M310 156l-18-46h36" />
		<path className="auth-body" d="M222 150c4-14 16-22 32-22h62c10 0 16 8 12 16l-8 18h-92c-6 0-8-6-6-12z" />
		<path className="auth-body" d="M300 112h40l10-14" />
		<rect className="auth-light" x="344" y="122" width="16" height="12" rx="5" />
		<Wheel cx={170} cy={226} r={44} /><Wheel cx={370} cy={226} r={44} />
	</g>
}

function Truck() {
	return <g>
		<rect className="auth-body is-cargo" x="40" y="92" width="270" height="118" rx="10" />
		<path className="auth-body" d="M316 120h80c12 0 22 6 28 16l34 52c4 6 6 12 6 18v4c0 8-6 14-14 14H316z" />
		<path className="auth-glass" d="M334 134h56c6 0 10 2 14 8l22 36h-92z" />
		<rect className="auth-light" x="450" y="196" width="16" height="10" rx="4" />
		<Wheel cx={110} cy={232} r={30} /><Wheel cx={190} cy={232} r={30} /><Wheel cx={404} cy={232} r={30} />
	</g>
}

export default function AuthScene() {
	const [kind, setKind] = useState('auto')
	const sceneRef = useRef(null)
	const vehicle = VEHICLES[kind]

	function onPointerMove(event) {
		const box = sceneRef.current?.getBoundingClientRect()
		if (!box) return
		const x = (event.clientX - box.left) / box.width - .5
		const y = (event.clientY - box.top) / box.height - .5
		sceneRef.current.style.setProperty('--tilt-x', (x * 10).toFixed(2))
		sceneRef.current.style.setProperty('--tilt-y', (y * -8).toFixed(2))
	}
	function onPointerLeave() {
		sceneRef.current?.style.setProperty('--tilt-x', '0')
		sceneRef.current?.style.setProperty('--tilt-y', '0')
	}

	return <div className="auth-scene" ref={sceneRef} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
		<div className="auth-scene-stage">
			<svg className="auth-scene-svg" viewBox="0 0 520 300" role="img" aria-label={`Ilustración: ${vehicle.label.toLowerCase()} en marcha`}>
				<path className="auth-road" d="M0 262h520v38H0z" />
				<path className="auth-road-lane" d="M0 282h520" />
				<g key={kind} className="auth-vehicle">{kind === 'moto' ? <Moto /> : kind === 'camion' ? <Truck /> : <Car />}</g>
			</svg>
			<ul className="auth-scene-tags" aria-label="Categorías de repuestos">
				{vehicle.tags.map((tag, index) => <li key={`${kind}-${tag}`} style={{ '--i': index }}>{tag}</li>)}
			</ul>
		</div>
		<div className="auth-scene-switch" role="group" aria-label="Tipo de vehículo de la ilustración">
			{Object.entries(VEHICLES).map(([key, item]) => <button key={key} type="button" aria-pressed={kind === key}
				className={kind === key ? 'is-active' : ''} onClick={() => setKind(key)}>{item.label}</button>)}
		</div>
	</div>
}
