import { useCallback, useEffect, useState } from 'react'
import { useConfirm } from '../context/confirmState.js'
import { useReverify } from '../context/reverifyState.js'
import { describePasskeyError, nativePasskeyAvailable, registerNativePasskey } from '../lib/passkeyProof.js'
import { Browser } from '@capacitor/browser'
import { isNativeApp } from '../lib/platform.js'
import { passkeysSupported } from '../lib/reauth.js'
import { supabase } from '../services/supabase.js'

const dateFormat = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeZone: 'America/La_Paz' })

// Huella y passkeys de la cuenta de administración (sesión 8). Una passkey (huella, rostro o
// Windows Hello) sirve para confirmar las acciones protegidas más rápido que el código.
// Requiere activar las passkeys en Supabase → Authentication → Passkeys.
export default function PasskeyManager() {
	const [items, setItems] = useState([])
	const [loading, setLoading] = useState(true)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const confirm = useConfirm()
	const reverify = useReverify()
	const supported = passkeysSupported()
	const siteUrl = (import.meta.env.VITE_PUBLIC_SITE_URL || '').replace(/\/+$/, '')

	const load = useCallback(async () => {
		setLoading(true)
		const { data, error: listError } = await supabase.auth.passkey.list()
		setItems(listError || !Array.isArray(data) ? [] : data)
		setLoading(false)
	}, [])
	useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])

	async function register() {
		setBusy(true)
		setError('')
		setNotice('')
		const device = /Android/i.test(navigator.userAgent) ? 'Android' : /iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone' : /Windows/i.test(navigator.userAgent) ? 'Windows' : /Mac/i.test(navigator.userAgent) ? 'Mac' : 'este equipo'
		const { data, error: registerError } = await (nativePasskeyAvailable ? registerNativePasskey() : supabase.auth.registerPasskey())
		if (registerError) { setBusy(false); setError(describePasskeyError(registerError)); return }
		if (data?.id && !data.friendly_name) await supabase.auth.passkey.update({ passkeyId: data.id, friendlyName: `Huella · ${device} · ${dateFormat.format(new Date())}` }).catch(() => {})
		setBusy(false)
		setNotice('Huella o passkey registrada. La usarás para confirmar acciones protegidas.')
		await load()
	}

	async function remove(item) {
		const ok = await confirm({ title: '¿Quitar esta huella o passkey?', message: `«${item.friendly_name || 'Passkey'}» dejará de servir para confirmar acciones. Podrás seguir usando el código del autenticador.`, confirmLabel: 'Quitar passkey', tone: 'danger' })
		if (!ok || !(await reverify('Para quitar una passkey confirma primero tu identidad.'))) return
		setBusy(true)
		setError('')
		const { error: removeError } = await supabase.auth.passkey.delete({ passkeyId: item.id })
		setBusy(false)
		if (removeError) { setError('No se pudo quitar la passkey. Inténtalo de nuevo.'); return }
		setNotice('Passkey eliminada.')
		await load()
	}

	return <section className="admin-passkeys" aria-labelledby="admin-passkeys-title">
		<h3 id="admin-passkeys-title">Huella y passkeys</h3>
		<p>Para bloquear cuentas, suspender tiendas, desactivar categorías o activar el mantenimiento se pide confirmar tu identidad. Con una passkey basta tu huella, tu rostro o Windows Hello; si no, se usa el código del autenticador.</p>
		{error && <p className="admin-alert" role="alert">{error}</p>}
		{notice && <p className="admin-notice" role="status">{notice}</p>}
		{loading ? <p role="status">Cargando passkeys…</p> : items.length === 0
			? <p className="admin-passkeys-empty">Todavía no registraste ninguna passkey en esta cuenta.</p>
			: <ul className="admin-passkeys-list">{items.map((item) => <li key={item.id}>
				<span><strong>{item.friendly_name || 'Passkey'}</strong><small>Registrada el {dateFormat.format(new Date(item.created_at))}{item.last_used_at ? ` · usada el ${dateFormat.format(new Date(item.last_used_at))}` : ''}</small></span>
				<button type="button" className="button button-secondary is-danger" onClick={() => { void remove(item) }} disabled={busy}>Quitar</button>
			</li>)}</ul>}
		{supported || nativePasskeyAvailable
			? <button type="button" className="button button-secondary" onClick={() => { void register() }} disabled={busy}>{busy ? 'Esperando tu huella…' : 'Registrar huella o passkey'}</button>
			: isNativeApp && siteUrl
				? <>
					<p className="auth-hint">En la app la huella se registra desde Chrome. Inicia sesión allí como administrador y vuelve a esta sección; después podrás usarla también en la app.</p>
					<button type="button" className="button button-secondary" onClick={() => { void Browser.open({ url: `${siteUrl}/admin` }).catch(() => {}) }}>Abrir DriveFix en Chrome</button>
				</>
				: <p className="auth-hint">Este navegador o la app no permiten registrar passkeys. Hazlo desde Chrome, Edge o Safari en la web.</p>}
	</section>
}
