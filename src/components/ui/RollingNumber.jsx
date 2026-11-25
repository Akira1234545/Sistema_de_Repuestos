import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { formatCount, prefersReducedMotion, rollingParts } from '../../lib/panel.js'

// Each column holds 0–9 twice, so a digit rolls past a full turn before landing on its value.
const COLUMN = Array.from({ length: 20 }, (_, index) => index % 10)
const landing = (digit) => -(10 + digit) * 5 // yPercent of a 20-row column

// Slot-machine number: every digit is a column of 0–9 that slides to its value (900 ms).
// The final value is in the markup from the first paint (screen readers and reduced motion
// read it as plain text); GSAP only animates the columns from 0.
export default function RollingNumber({ value, decimals = 0, className = '' }) {
	const ref = useRef(null)
	const text = formatCount(value, decimals)
	const parts = rollingParts(text)

	useLayoutEffect(() => {
		const node = ref.current
		if (!node || prefersReducedMotion()) return undefined
		const columns = Array.from(node.querySelectorAll('[data-digit]'))
		if (!columns.length) return undefined
		const tween = gsap.fromTo(columns, { y: 0, yPercent: 0 }, {
			y: 0, // GSAP reads the inline translateY(%) as px; keep that part at 0 and drive yPercent only
			yPercent: (index, column) => landing(Number(column.dataset.digit)),
			duration: .9, ease: 'power3.out', stagger: { each: .06, from: 'end' },
		})
		return () => tween.kill()
	}, [text])

	return <span className={`rolling-number${className ? ` ${className}` : ''}`} ref={ref}>
		<span className="visually-hidden">{text}</span>
		<span className="rolling-number-track" aria-hidden="true">
			{parts.map((part, index) => part.digit == null
				? <span className="rolling-number-sep" key={`s${parts.length - index}`}>{part.char}</span>
				: <span className="rolling-number-window" key={`d${parts.length - index}`}>
					<span className="rolling-number-column" data-digit={part.digit} style={{ transform: `translateY(${landing(part.digit)}%)` }}>
						{COLUMN.map((digit, row) => <span key={row}>{digit}</span>)}
					</span>
				</span>)}
		</span>
	</span>
}
