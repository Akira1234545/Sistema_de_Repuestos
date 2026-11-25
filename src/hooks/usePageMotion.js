import { useLayoutEffect } from 'react'
import { gsap } from 'gsap'
import { isNativeApp } from '../lib/platform.js'

// Set by PageOutlet when a page leaves, so the next one waits for the outgoing blur (180 ms).
let lastLeave = 0
export function markPageLeave() { lastLeave = performance.now() }

// Containers whose children are records loaded after the page mounts.
const LIST_SELECTOR = [
	'.request-list', '.vehicle-list', '.store-request-list', '.promo-grid', '.favorites-list',
	'.public-stores-grid', '.proposal-comparison-grid', '.received-reviews-list', '.admin-store-list',
	'.admin-user-list', '.admin-request-list', '.admin-promotion-list', '.admin-category-list', '.stat-strip',
	'.notification-list', '.categories-grid',
].join(',')

// Page entrance plus a staggered entrance for list items as they arrive from Supabase.
// Content is always rendered; only presentation animates, and nothing runs with reduced motion.
export function usePageMotion(containerRef) {
	useLayoutEffect(() => {
		const container = containerRef.current
		if (!container || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

		const page = container.firstElementChild
		// Sesión 7: blocks enter scaled (.96 → 1), blurred (6 px → 0) and faded, 450 ms, 60 ms apart.
		// The blur is skipped in the Android app, where filters are costly.
		const delay = performance.now() - lastLeave < 400 ? .14 : 0
		const from = isNativeApp ? { y: 12, scale: .98, opacity: 0 } : { y: 12, scale: .96, opacity: 0, filter: 'blur(6px)' }
		const to = { y: 0, scale: 1, opacity: 1, ...(isNativeApp ? {} : { filter: 'blur(0px)' }), duration: .45, delay, ease: 'power3.out', stagger: .06, clearProps: 'transform,opacity,filter' }
		const entrance = page ? gsap.fromTo(Array.from(page.children).slice(0, 8), from, to) : null

		const seen = new WeakSet()
		const reveal = (nodes) => {
			const fresh = nodes.filter((node) => node instanceof HTMLElement && !seen.has(node) && !node.matches('.skeleton-card, .visually-hidden'))
			if (!fresh.length) return
			fresh.forEach((node) => seen.add(node))
			gsap.fromTo(fresh.slice(0, 18), { y: 22, opacity: 0, scale: .985 }, { y: 0, opacity: 1, scale: 1, duration: .5, ease: 'power3.out', stagger: .045, clearProps: 'transform,opacity' })
		}
		const observer = new MutationObserver((mutations) => {
			const added = []
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (!(node instanceof HTMLElement)) continue
					if (node.matches(LIST_SELECTOR)) added.push(...node.children)
					else if (node.parentElement?.matches(LIST_SELECTOR)) added.push(node)
					else node.querySelectorAll?.(LIST_SELECTOR).forEach((list) => added.push(...list.children))
				}
			}
			reveal(added)
		})
		observer.observe(container, { childList: true, subtree: true })
		// Lists already present at mount were covered by the page entrance.
		container.querySelectorAll(LIST_SELECTOR).forEach((list) => Array.from(list.children).forEach((child) => seen.add(child)))

		return () => { observer.disconnect(); entrance?.kill() }
	}, [containerRef])
}
