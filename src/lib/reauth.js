// Reverificación para acciones críticas (sesión 8). El servidor exige que la sesión haya
// confirmado un segundo factor hace muy poco (public.drivefix_reverificacion_reciente, 25 s para
// cubrir la red); aquí la app solo evita volver a pedirlo dentro de los 15 s siguientes.
export const REVERIFY_GRACE_SECONDS = 15
const MFA_METHODS = new Set(['totp', 'mfa/totp', 'webauthn', 'mfa/webauthn', 'phone', 'mfa/phone'])

export function decodeJwt(token) {
	try {
		const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
		return JSON.parse(decodeURIComponent(escape(atob(payload))))
	} catch {
		return null
	}
}

export function hasRecentSecondFactor(accessToken, seconds = REVERIFY_GRACE_SECONDS, now = Date.now()) {
	const claims = accessToken ? decodeJwt(accessToken) : null
	const amr = Array.isArray(claims?.amr) ? claims.amr : []
	const limit = Math.floor(now / 1000) - seconds
	return amr.some((entry) => MFA_METHODS.has(entry?.method) && Number(entry?.timestamp) >= limit)
}

// WebAuthn disponible en este navegador (en el WebView de Android normalmente no lo está).
export function passkeysSupported() {
	return typeof window !== 'undefined' && Boolean(window.PublicKeyCredential) && Boolean(navigator.credentials?.get)
}
