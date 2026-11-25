import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ReverifyContext } from '../../context/reverifyState.js'
import { useLayer } from '../../lib/layers.js'
import { Browser } from '@capacitor/browser'
import { PASSKEY_RETURN_EVENT, nativePasskeyAvailable, provePasskey } from '../../lib/passkeyProof.js'
import { isNativeApp } from '../../lib/platform.js'
import { REVERIFY_GRACE_SECONDS, hasRecentSecondFactor, passkeysSupported } from '../../lib/reauth.js'
import { supabase } from '../../services/supabase.js'

// «Confirma que eres tú» (sesión 8). Antes de una acción crítica de administración pide la
// huella / passkey (WebAuthn, lib/passkeyProof.js) o el código del autenticador. El servidor exige
// una de las dos hecha hace un momento (drivefix_reverificacion_reciente). Pasados 15 s se pide de nuevo.
const PASSKEY_WINDOW_MS = REVERIFY_GRACE_SECONDS * 1000
let lastPasskeyProof = 0
// En la app Android la huella se pone en Chrome (/verificar-huella) y aquí se confirma en el servidor.
const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || '').replace(/\/+$/, '')
// Respaldo con Chrome solo si esta versión de la app no trae la huella nativa.
const browserPasskey = isNativeApp && !nativePasskeyAvailable && Boolean(SITE_URL)

function waitForBrowserReturn() {
	return new Promise((resolve) => {
		let done = false
		const handles = []
		const finish = () => {
			if (done) return
			done = true
			window.removeEventListener(PASSKEY_RETURN_EVENT, finish)
			handles.forEach((handle) => { void handle.remove() })
			void Browser.close().catch(() => {})
			resolve()
		}
		window.addEventListener(PASSKEY_RETURN_EVENT, finish)
		// También si la persona cierra la pestaña de Chrome sin usar el enlace de vuelta.
		void Browser.addListener('browserFinished', finish).then((handle) => { if (done) void handle.remove(); else handles.push(handle) }).catch(() => {})
	})
}

async function provePasskeyInBrowser() {
	const back = waitForBrowserReturn()
	try {
		await Browser.open({ url: `${SITE_URL}/verificar-huella`, presentationStyle: 'popover' })
	} catch {
		window.dispatchEvent(new Event(PASSKEY_RETURN_EVENT))
		await back
		return { ok: false, reason: 'failed' }
	}
	await back
	const { data, error } = await supabase.rpc('drivefix_reverificacion_reciente')
	return error || data !== true ? { ok: false, reason: 'not-confirmed' } : { ok: true }
}
export default function ReverifyProvider({ children }) {
	const [request, setRequest] = useState(null)
	const [factors, setFactors] = useState({ passkey: null, totp: null, loading: true })
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const dialogRef = useRef(null)
	const firstRef = useRef(null)
	const titleId = useId()

	const reverify = useCallback(async (reason) => {
		if (!supabase) return false
		const { data } = await supabase.auth.getSession()
		if (hasRecentSecondFactor(data.session?.access_token) || Date.now() - lastPasskeyProof < PASSKEY_WINDOW_MS) return true
		return new Promise((resolve) => {
			setError('')
			setFactors((current) => ({ ...current, loading: true }))
			setRequest((current) => { current?.resolve(false); return { reason, resolve } })
		})
	}, [])

	const finish = useCallback((answer) => {
		setRequest((current) => { current?.resolve(answer); return null })
		setBusy(false)
	}, [])

	useLayer(Boolean(request), () => finish(false))

	useEffect(() => {
		if (!request) return undefined
		let active = true
		Promise.all([
			supabase.auth.mfa.listFactors().catch(() => ({ data: null })),
			supabase.auth.passkey.list().catch(() => ({ data: null })),
		]).then(([mfa, passkeys]) => {
			if (!active) return
			const verified = (mfa.data?.all || []).filter((factor) => factor.status === 'verified')
			const list = Array.isArray(passkeys.data) ? passkeys.data : []
			setFactors({ passkey: list.length > 0 ? list[0] : null, totp: verified.find((factor) => factor.factor_type === 'totp') || null, loading: false })
		})
		const dialog = dialogRef.current
		if (dialog && !dialog.open) dialog.showModal?.()
		return () => { active = false }
	}, [request])

	useEffect(() => { if (request && !factors.loading) firstRef.current?.focus() }, [request, factors.loading])

	async function confirmWithPasskey() {
		setBusy(true)
		setError('')
		const { data } = await supabase.auth.getSession()
		const result = browserPasskey ? await provePasskeyInBrowser() : await provePasskey(data.session?.user?.id)
		if (!result.ok) {
			if (result.detail) console.warn('[DriveFix] huella:', result.detail)
			setBusy(false)
			setError(result.reason === 'other-account'
				? 'Esa passkey es de otra cuenta. Elige la passkey de esta cuenta de administración.'
				: result.reason === 'not-confirmed'
					? 'No se confirmó la huella de esta cuenta. Inténtalo de nuevo o usa el código.'
					: result.reason === 'no-credential'
						? 'Este teléfono no tiene una passkey de DriveFix. Regístrala en Configuración o usa el código.'
					: result.reason === 'cancelled'
					? 'Se canceló la huella o passkey. Inténtalo de nuevo o usa el código.'
					: 'No se pudo confirmar con la huella o passkey. Inténtalo de nuevo o usa el código.')
			return
		}
		lastPasskeyProof = Date.now()
		finish(true)
	}

	async function confirmWithCode(event) {
		event.preventDefault()
		const code = new FormData(event.currentTarget).get('code')
		setBusy(true)
		setError('')
		const { error: codeError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factors.totp.id, code })
		if (codeError) { setBusy(false); setError('El código no es válido o ya venció. Escribe el que muestra ahora tu autenticador.'); return }
		finish(true)
	}

	const canPasskey = Boolean(factors.passkey) && (nativePasskeyAvailable || browserPasskey || passkeysSupported())
	return <ReverifyContext.Provider value={reverify}>
		{children}
		{request && <dialog ref={dialogRef} className="confirm-dialog reverify-dialog" aria-labelledby={titleId}
			onCancel={(event) => { event.preventDefault(); finish(false) }}>
			<div className="confirm-dialog-body">
				<p className="eyebrow">Acción protegida</p>
				<h2 id={titleId}>Confirma que eres tú</h2>
				<p>{request.reason || 'Esta acción necesita que confirmes tu identidad.'}</p>
				{factors.loading ? <p role="status">Buscando tus métodos de verificación…</p> : <>
					{canPasskey && <button ref={firstRef} type="button" className="button reverify-passkey" onClick={() => { void confirmWithPasskey() }} disabled={busy}>
						<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 11v4M8.5 8.5a5 5 0 0 1 7 0M6 12a6 6 0 0 1 12 0v1M9 14a3 3 0 0 0 6 0v-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
						{busy ? 'Esperando tu huella…' : browserPasskey ? 'Usar huella (se abre Chrome)' : 'Usar huella o passkey'}
					</button>}
					{factors.totp && <form className="reverify-code" onSubmit={(event) => { void confirmWithCode(event) }}>
						<label>{canPasskey ? 'O escribe el código de tu autenticador' : 'Código de seis dígitos de tu autenticador'}
							<input ref={canPasskey ? undefined : firstRef} name="code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" required />
						</label>
						<button type="submit" className={canPasskey ? 'button button-secondary' : 'button'} disabled={busy}>Verificar código</button>
					</form>}
					{!canPasskey && !factors.totp && <p className="auth-error" role="alert">Tu cuenta no tiene un segundo factor configurado.</p>}
					{factors.passkey && !canPasskey && <p className="auth-hint">Este dispositivo no permite usar passkeys aquí; usa el código.</p>}
				</>}
				{error && <p className="auth-error" role="alert">{error}</p>}
				<div className="confirm-dialog-actions">
					<button type="button" className="button button-secondary" onClick={() => finish(false)}>Cancelar</button>
				</div>
			</div>
		</dialog>}
	</ReverifyContext.Provider>
}
