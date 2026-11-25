import { Capacitor, registerPlugin } from '@capacitor/core'
import { isNativeApp } from './platform.js'
import { supabase, supabaseAuthEndpoint, supabasePublicKey } from '../services/supabase.js'

// En la app Android la huella se pide con Credential Manager (android/…/NativePasskeyPlugin.java);
// Supabase ve el origen android:apk-key-hash:… y el dominio se asocia en /.well-known/assetlinks.json.
const NativePasskey = registerPlugin('NativePasskey')
export const nativePasskeyAvailable = isNativeApp && Capacitor.isPluginAvailable('NativePasskey')

// Confirmación con huella o passkey (sesión 8). Supabase ofrece las passkeys como forma de
// iniciar sesión (Authentication → Passkeys), no como factor MFA. Para no reemplazar la sesión
// del administrador, la ceremonia se hace aquí a mano: Supabase valida la firma, marca la
// passkey como usada (auth.webauthn_credentials.last_used_at, que el servidor consulta en
// drivefix_reverificacion_reciente) y devuelve una sesión aparte que cerramos al momento.

function fromBase64Url(value) {
	const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
	return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer
}

function toBase64Url(buffer) {
	let text = ''
	for (const byte of new Uint8Array(buffer)) text += String.fromCharCode(byte)
	return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function parseRequestOptions(options) {
	if (typeof PublicKeyCredential !== 'undefined' && typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function') {
		return PublicKeyCredential.parseRequestOptionsFromJSON(options)
	}
	return {
		...options,
		challenge: fromBase64Url(options.challenge),
		allowCredentials: options.allowCredentials?.map((item) => ({ ...item, id: fromBase64Url(item.id), type: item.type || 'public-key' })),
	}
}

function serializeAssertion(credential) {
	if (typeof credential.toJSON === 'function') return credential.toJSON()
	const response = credential.response
	return {
		id: credential.id,
		rawId: credential.id,
		type: 'public-key',
		response: {
			authenticatorData: toBase64Url(response.authenticatorData),
			clientDataJSON: toBase64Url(response.clientDataJSON),
			signature: toBase64Url(response.signature),
			userHandle: response.userHandle ? toBase64Url(response.userHandle) : undefined,
		},
		clientExtensionResults: credential.getClientExtensionResults(),
		authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
	}
}

// La app Android abre /verificar-huella en Chrome y vuelve con este enlace (ver NativeShell).
export const PASSKEY_RETURN_URL = 'com.drivefix.app://auth/huella-lista'
export const PASSKEY_RETURN_EVENT = 'drivefix:huella-lista'

const authHeaders = { apikey: supabasePublicKey, 'Content-Type': 'application/json' }

async function webAssertion(options) {
	try {
		// La huella o el PIN del equipo son obligatorios aquí, no solo tener el dispositivo.
		const credential = await navigator.credentials.get({ publicKey: { ...parseRequestOptions(options), userVerification: 'required' } })
		return credential ? { credential: serializeAssertion(credential) } : { reason: 'cancelled' }
	} catch {
		return { reason: 'cancelled' }
	}
}

async function nativeAssertion(options) {
	try {
		const { response } = await NativePasskey.authenticate({ requestJson: JSON.stringify({ ...options, userVerification: 'required' }) })
		return { credential: JSON.parse(response) }
	} catch (error) {
		const code = error?.code
		if (code !== 'cancelled') console.warn('[DriveFix] passkey nativa:', code, error?.message)
		return { reason: code === 'cancelled' ? 'cancelled' : code === 'no-credential' ? 'no-credential' : 'failed', detail: String(error?.message || code || '').slice(0, 300) }
	}
}

// Devuelve { ok: true } o { ok: false, reason: 'cancelled' | 'no-credential' | 'other-account' | 'failed' }. Sin
// expectedUserId (página /verificar-huella de la app) no se compara: el servidor ya solo acepta
// la passkey de la cuenta que hace el cambio.
export async function provePasskey(expectedUserId) {
	const { data: start, error: startError } = await supabase.auth.passkey.startAuthentication()
	if (startError || !start?.options) return { ok: false, reason: 'failed' }

	const assertion = nativePasskeyAvailable ? await nativeAssertion(start.options) : await webAssertion(start.options)
	if (!assertion.credential) return { ok: false, reason: assertion.reason, detail: assertion.detail }

	let session
	try {
		const response = await fetch(`${supabaseAuthEndpoint}/passkeys/authentication/verify`, {
			method: 'POST',
			headers: authHeaders,
			body: JSON.stringify({ challenge_id: start.challenge_id, credential: assertion.credential }),
		})
		session = response.ok ? await response.json() : null
	} catch {
		session = null
	}
	if (!session?.access_token) return { ok: false, reason: 'failed' }

	// Cerramos la sesión extra que crea Supabase; la del administrador sigue igual.
	void fetch(`${supabaseAuthEndpoint}/logout?scope=local`, {
		method: 'POST',
		headers: { ...authHeaders, Authorization: `Bearer ${session.access_token}` },
	}).catch(() => {})

	if (expectedUserId && session.user?.id !== expectedUserId) return { ok: false, reason: 'other-account' }
	return { ok: true }
}

// Registro nativo en la app Android (Credential Manager). Devuelve { data, error } como registerPasskey.
export async function registerNativePasskey() {
	const { data: start, error: startError } = await supabase.auth.passkey.startRegistration()
	if (startError || !start?.options) return { data: null, error: startError || { message: 'failed' } }
	let credential
	try {
		const { response } = await NativePasskey.register({ requestJson: JSON.stringify(start.options) })
		credential = JSON.parse(response)
	} catch (error) {
		if (error?.code !== 'cancelled') console.warn('[DriveFix] registro de passkey nativa:', error?.code, error?.message)
		return { data: null, error: { code: error?.code === 'cancelled' ? 'cancelled' : 'native_failed', message: String(error?.message || '') } }
	}
	return supabase.auth.passkey.verifyRegistration({ challengeId: start.challenge_id, credential })
}

export function describePasskeyError(error) {
	const code = String(error?.code || '')
	const text = String(error?.message || '')
	if (code === 'passkey_disabled' || /passkey.*(disabled|not enabled)/i.test(text)) return 'Las passkeys no están activadas en Supabase (Authentication → Passkeys).'
	if (code === 'webauthn_credential_exists') return 'Este dispositivo ya tiene una passkey registrada en tu cuenta.'
	if (code === 'too_many_passkeys') return 'Llegaste al máximo de passkeys. Quita una antes de agregar otra.'
	return 'No se registró la huella o passkey. Si cancelaste, vuelve a intentarlo.'
}
