import { useLayoutEffect } from 'react'
import { gsap } from 'gsap'

// Short entrance for private pages: first-level blocks settle in sequence when the
// page mounts. Content is always rendered; only presentation animates.
export function usePageMotion(containerRef) {
	useLayoutEffect(() => {
		const container = containerRef.current
		if (!container) return undefined
		const context = gsap.context(() => {
			gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
				const page = container.firstElementChild
				if (!page) return
				const blocks = Array.from(page.children).slice(0, 8)
				gsap.fromTo(blocks, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: .55, ease: 'power3.out', stagger: .05, clearProps: 'transform,opacity' })
			})
		}, container)
		return () => context.revert()
	}, [containerRef])
}
