import { useCallback, useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { isNativeApp } from '../lib/platform.js'
import { prefersReducedMotion } from '../lib/panel.js'

gsap.registerPlugin(Flip)

const LENS_KEY = 'repuestospro:panel-lens'

// Circular «lens» that opens the panel after signing in: clip-path circle 0 → 150 % and
// blur 12 px → 0 (700 ms). Once per browser session, web only, never with reduced motion.
export function usePanelLens(ref) {
	useLayoutEffect(() => {
		const node = ref.current
		if (!node || isNativeApp || prefersReducedMotion()) return undefined
		try { if (sessionStorage.getItem(LENS_KEY)) return undefined } catch { return undefined }
		const done = () => { try { sessionStorage.setItem(LENS_KEY, '1') } catch { /* private mode: it may replay */ } }
		const tween = gsap.fromTo(node,
			{ clipPath: 'circle(0% at 50% 42%)', filter: 'blur(12px)' },
			{ clipPath: 'circle(150% at 50% 42%)', filter: 'blur(0px)', duration: .7, ease: 'power2.inOut', clearProps: 'clipPath,filter', onComplete: done })
		return () => { tween.kill(); gsap.set(node, { clearProps: 'clipPath,filter' }) }
	}, [ref])
}

// Animates the sidebar column between rail (76 px) and full (264 px) when `mode` changes.
// CSS owns the resting widths (they change at 1100 px); GSAP only tweens the variable in between.
export function useSidebarWidth(shellRef, mode) {
	const fromWidth = useRef(null)
	const first = useRef(true)

	useLayoutEffect(() => {
		const shell = shellRef.current
		if (!shell) return undefined
		if (first.current) { first.current = false; return undefined }
		const from = fromWidth.current
		fromWidth.current = null
		if (from == null || prefersReducedMotion()) return undefined
		const to = getComputedStyle(shell).getPropertyValue('--sidebar-current').trim()
		const tween = gsap.fromTo(shell, { '--sidebar-current': `${from}px` }, {
			'--sidebar-current': to, duration: .45, ease: 'power3.inOut',
			onComplete: () => shell.style.removeProperty('--sidebar-current'),
		})
		return () => { tween.kill(); shell.style.removeProperty('--sidebar-current') }
	}, [shellRef, mode])

	// Call before switching the mode, so the tween starts from the width on screen.
	return useCallback((sidebar) => { fromWidth.current = sidebar?.getBoundingClientRect().width ?? null }, [])
}

// One «pill» that slides to the active item with GSAP Flip. The pill is rendered inside the
// active item (matched by data-flip-id); `capture` records where it was just before navigating.
export function useSlidingPill(containerRef, activeKey) {
	const state = useRef(null)
	const capture = useCallback(() => {
		const pill = containerRef.current?.querySelector('[data-flip-id]')
		state.current = pill ? Flip.getState(pill) : null
	}, [containerRef])

	useLayoutEffect(() => {
		const previous = state.current
		state.current = null
		const pill = containerRef.current?.querySelector('[data-flip-id]')
		if (!previous || !pill || prefersReducedMotion()) return undefined
		const tween = Flip.from(previous, { targets: pill, duration: .45, ease: 'power3.inOut', absolute: false, scale: false })
		return () => tween.kill()
	}, [containerRef, activeKey])

	return capture
}
