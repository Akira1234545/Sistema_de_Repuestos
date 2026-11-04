import { useState } from 'react'

// Remembers the chosen list layout per screen on this device (a convenience, not account data).
export function useViewMode(key, modes, fallback) {
	const storageKey = `repuestospro:view:${key}`
	const [mode, setMode] = useState(() => {
		try {
			const saved = localStorage.getItem(storageKey)
			return modes.includes(saved) ? saved : fallback
		} catch { return fallback }
	})
	function change(next) {
		setMode(next)
		try { localStorage.setItem(storageKey, next) } catch { /* Private mode: keep it for this visit only. */ }
	}
	return [mode, change]
}
