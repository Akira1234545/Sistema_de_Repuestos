import { Suspense, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { usePageMotion } from '../hooks/usePageMotion.js'
import { announceRoute } from '../lib/routeIdentity.js'

function AnimatedPage() {
	const ref = useRef(null)
	usePageMotion(ref)
	useLayoutEffect(() => { announceRoute() }, [])
	return <div className="page-transition" ref={ref}><Outlet /></div>
}

// Keeps the shell visible while a lazy page loads and animates each new page in.
export default function PageOutlet() {
	const { pathname } = useLocation()
	return <Suspense fallback={<p className="route-loading" role="status">Cargando página…</p>}>
		<AnimatedPage key={pathname} />
	</Suspense>
}
