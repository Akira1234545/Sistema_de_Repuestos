import { useEffect, useRef, useState } from 'react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { REFRESH_EVENT } from '../lib/events.js'

const THRESHOLD = 76
const MAX_PULL = 120

// Native-style pull to refresh for the Android app: drag down from the top of a page to reload it.
export default function PullToRefresh() {
	const [pull, setPull] = useState(0)
	const [refreshing, setRefreshing] = useState(false)
	const start = useRef(null)
	const armed = useRef(false)

	useEffect(() => {
		function onStart(event) {
			const blocked = event.target.closest('input, textarea, select, iframe, .notification-popover, .client-sidebar, .store-sidebar, .admin-tabs')
			start.current = window.scrollY <= 0 && !blocked && event.touches.length === 1 ? event.touches[0].clientY : null
			armed.current = false
		}
		function onMove(event) {
			if (start.current == null) return
			const distance = event.touches[0].clientY - start.current
			if (distance <= 0) { setPull(0); return }
			const eased = Math.min(MAX_PULL, distance * .5)
			setPull(eased)
			if (eased >= THRESHOLD && !armed.current) { armed.current = true; void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}) }
			if (eased < THRESHOLD) armed.current = false
		}
		function onEnd() {
			if (start.current == null) return
			start.current = null
			if (armed.current) {
				setRefreshing(true)
				window.dispatchEvent(new Event(REFRESH_EVENT))
				window.setTimeout(() => { setRefreshing(false); setPull(0) }, 700)
			} else setPull(0)
			armed.current = false
		}
		window.addEventListener('touchstart', onStart, { passive: true })
		window.addEventListener('touchmove', onMove, { passive: true })
		window.addEventListener('touchend', onEnd, { passive: true })
		window.addEventListener('touchcancel', onEnd, { passive: true })
		return () => {
			window.removeEventListener('touchstart', onStart)
			window.removeEventListener('touchmove', onMove)
			window.removeEventListener('touchend', onEnd)
			window.removeEventListener('touchcancel', onEnd)
		}
	}, [])

	const progress = Math.min(1, pull / THRESHOLD)
	if (!pull && !refreshing) return null
	return <div className={`pull-refresh${refreshing ? ' is-refreshing' : ''}${progress >= 1 ? ' is-armed' : ''}`} style={{ '--pull': `${refreshing ? THRESHOLD : pull}px`, '--progress': progress }} aria-hidden="true">
		<span className="pull-refresh-icon">↻</span>
	</div>
}
