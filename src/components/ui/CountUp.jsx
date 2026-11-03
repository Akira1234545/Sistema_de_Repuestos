import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'

const format = (value, decimals) => Number(value).toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

// Animates a number from 0 to `value`; renders the final value directly when motion is reduced.
export default function CountUp({ value, decimals = 0 }) {
	const ref = useRef(null)
	useLayoutEffect(() => {
		const node = ref.current
		if (!node) return undefined
		const target = Number(value) || 0
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = format(target, decimals); return undefined }
		const counter = { value: 0 }
		const tween = gsap.to(counter, { value: target, duration: 1.1, ease: 'power3.out', onUpdate: () => { node.textContent = format(counter.value, decimals) } })
		return () => tween.kill()
	}, [value, decimals])
	return <span ref={ref}>{format(value || 0, decimals)}</span>
}
