import { isNativeApp } from './platform.js'

// Public web address used in shared links; the app's own origin is not reachable from other devices.
const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || '').replace(/\/$/, '')

export function publicUrl(path) {
	if (SITE_URL) return `${SITE_URL}${path}`
	return isNativeApp ? '' : `${window.location.origin}${path}`
}

// Opens the system share sheet. Returns 'shared', 'copied' or 'cancelled'.
export async function shareContent({ title, text, path }) {
	const url = publicUrl(path)
	if (isNativeApp) {
		const { Share } = await import('@capacitor/share')
		try { await Share.share({ title, text, url: url || undefined, dialogTitle: 'Compartir' }); return 'shared' }
		catch { return 'cancelled' }
	}
	if (navigator.share) {
		try { await navigator.share({ title, text, url }); return 'shared' }
		catch { return 'cancelled' }
	}
	await navigator.clipboard.writeText([text, url].filter(Boolean).join('\n'))
	return 'copied'
}
