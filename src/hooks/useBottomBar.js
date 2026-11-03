import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// On the phone the sidebar becomes a horizontally scrollable bottom bar: keep the active
// section in view and flag hidden overflow so CSS can fade the edge that has more items.
export function useBottomBar(navRef) {
	const { pathname } = useLocation()

	useEffect(() => {
		const nav = navRef.current
		if (!nav) return undefined
		const update = () => {
			nav.dataset.moreStart = nav.scrollLeft > 4 ? 'true' : 'false'
			nav.dataset.moreEnd = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 4 ? 'true' : 'false'
		}
		update()
		nav.addEventListener('scroll', update, { passive: true })
		window.addEventListener('resize', update)
		return () => { nav.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
	}, [navRef])

	useEffect(() => {
		const nav = navRef.current
		if (!nav || nav.scrollWidth <= nav.clientWidth) return
		const active = nav.querySelector('.active')
		if (!active) return
		const left = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2
		nav.scrollTo({ left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
	}, [navRef, pathname])
}
