import { useLayoutEffect } from 'react'
import { gsap } from 'gsap'

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
		const entrance = page
			? gsap.fromTo(Array.from(page.children).slice(0, 8), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: .55, ease: 'power3.out', stagger: .05, clearProps: 'transform,opacity' })
			: null

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
