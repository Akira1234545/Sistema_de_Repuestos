import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { percentOf, prefersReducedMotion } from '../../lib/panel.js'
import RollingNumber from './RollingNumber.jsx'

const SIZE = 148
const STROKE = 12
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// Ring that fills to value / total (1 s) with optional initials orbiting it (scale 0 → 1).
// `orbit` must come from real records (e.g. store names); it is decorative for screen readers,
// which get the «X de Y» sentence instead.
export default function ProgressRing({ value, total, label, caption, orbit = [], loading = false }) {
	const ref = useRef(null)
	const percent = loading ? null : percentOf(value, total)
	const offset = CIRCUMFERENCE * (1 - (percent || 0) / 100)

	useLayoutEffect(() => {
		const node = ref.current
		if (!node || percent == null || prefersReducedMotion()) return undefined
		const timeline = gsap.timeline()
		const arc = node.querySelector('.progress-ring-value')
		if (arc) timeline.fromTo(arc, { strokeDashoffset: CIRCUMFERENCE }, { strokeDashoffset: offset, duration: 1, ease: 'power3.out' })
		const satellites = node.querySelectorAll('.progress-ring-orbit li > span')
		if (satellites.length) timeline.fromTo(satellites, { scale: 0 }, { scale: 1, duration: .45, ease: 'back.out(1.8)', stagger: .08, clearProps: 'transform' }, .3)
		return () => timeline.kill()
	}, [percent, offset, orbit.length])

	return <figure className="progress-ring" ref={ref}>
		<div className="progress-ring-dial">
			<svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false">
				<circle className="progress-ring-track" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} />
				{percent != null && percent > 0 && <circle className="progress-ring-value" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE}
					strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />}
			</svg>
			<div className="progress-ring-center">
				<strong>{percent == null ? '—' : <><RollingNumber value={percent} /><small>%</small></>}</strong>
				{label && <span>{label}</span>}
			</div>
			{orbit.length > 0 && <ul className="progress-ring-orbit" aria-hidden="true">
				{orbit.slice(0, 6).map((item, index, list) => <li key={item.key} title={item.title} style={{ '--angle': `${-90 + (index * 360) / list.length}deg` }}><span>{item.label}</span></li>)}
			</ul>}
		</div>
		{caption && <figcaption>{caption}</figcaption>}
	</figure>
}
