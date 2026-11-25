import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { gsap } from 'gsap'
import { markPageLeave, usePageMotion } from '../hooks/usePageMotion.js'
import { announceRoute } from '../lib/routeIdentity.js'
import { REFRESH_EVENT } from '../lib/events.js'
import { prefersReducedMotion } from '../lib/panel.js'
import { isNativeApp } from '../lib/platform.js'

// Section change (sesión 7): the page that leaves is copied into a non-interactive layer that
// fades to 40 % with an 8 px blur (180 ms) while the new page mounts underneath and enters
// (usePageMotion). The copy is plain DOM outside React, removed when the fade ends.
function leaveWithBlur(page) {
	const stage = page?.parentElement
	if (!stage || prefersReducedMotion()) return
	markPageLeave()
	const ghost = page.cloneNode(true)
	ghost.classList.add('page-ghost')
	ghost.setAttribute('aria-hidden', 'true')
	ghost.setAttribute('inert', '')
	ghost.removeAttribute('id')
	ghost.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'))
	// React may still be inside the same commit; let it finish removing the real page first.
	queueMicrotask(() => {
		if (page.isConnected || !stage.isConnected) return // StrictMode re-run, or the whole panel is closing
		stage.prepend(ghost)
		// No blur in the Android app: a full-page filter is too costly on mid-range phones.
		gsap.timeline({ onComplete: () => ghost.remove() })
			.to(ghost, { opacity: isNativeApp ? 0 : .4, filter: isNativeApp ? 'none' : 'blur(8px)', duration: .18, ease: 'power1.in' })
			.to(ghost, { opacity: 0, duration: .12, ease: 'none' })
	})
}

function AnimatedPage() {
	const ref = useRef(null)
	usePageMotion(ref)
	useLayoutEffect(() => {
		const page = ref.current
		if (!page || announceRoute(page)) return undefined
		const observer = new MutationObserver(() => { if (announceRoute(page)) observer.disconnect() })
		observer.observe(page, { childList: true, subtree: true })
		return () => observer.disconnect()
	}, [])
	useLayoutEffect(() => {
		const page = ref.current
		return () => leaveWithBlur(page)
	}, [])
	return <div className="page-transition" ref={ref}><Outlet /></div>
}

// Keeps the shell visible while a lazy page loads and animates each new page in.
// A REFRESH_EVENT (pull to refresh in the app) remounts the page so it reloads its data.
export default function PageOutlet() {
	const { pathname } = useLocation()
	const [revision, setRevision] = useState(0)
	useEffect(() => {
		const refresh = () => setRevision((value) => value + 1)
		window.addEventListener(REFRESH_EVENT, refresh)
		return () => window.removeEventListener(REFRESH_EVENT, refresh)
	}, [])
	return <div className="page-stage">
		<Suspense fallback={<p className="route-loading" role="status">Cargando página…</p>}>
			<AnimatedPage key={`${pathname}:${revision}`} />
		</Suspense>
	</div>
}
