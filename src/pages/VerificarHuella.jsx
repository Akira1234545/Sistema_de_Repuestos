import { useState } from 'react'
import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo.jsx'
import { PASSKEY_RETURN_URL, provePasskey } from '../lib/passkeyProof.js'
import { passkeysSupported } from '../lib/reauth.js'

// Huella para la app Android (sesión 8). La vista interna de la app no permite passkeys, así que
// la app abre esta página en una pestaña segura de Chrome. Aquí se pone la huella (Supabase
// valida la firma y marca la passkey como usada) y se vuelve a la app, que comprueba en el
// servidor que la verificación es de su cuenta. Esta página no inicia sesión ni guarda nada.

function VerificarHuella() {
	const [state, setState] = useState('idle')
	const supported = passkeysSupported()

	async function verify() {
		setState('busy')
		const result = await provePasskey()
		if (!result.ok) { setState(result.reason === 'cancelled' ? 'cancelled' : 'failed'); return }
		setState('done')
		window.location.assign(PASSKEY_RETURN_URL)
	}

	return <main className="auth-page passkey-page">
		<div className="auth-intro"><Link className="brand" to="/"><BrandLogo /></Link><p>Confirma con tu huella y vuelve a la app.</p></div>
		<section className="auth-card" aria-labelledby="passkey-page-title">
			<p className="eyebrow">Acción protegida</p>
			<h1 id="passkey-page-title">{state === 'done' ? 'Listo' : 'Usa tu huella'}</h1>
			{state === 'done'
				? <>
					<p role="status">Tu identidad quedó confirmada. Vuelve a DriveFix antes de 15 segundos para terminar la acción.</p>
					<a className="button" href={PASSKEY_RETURN_URL}>Volver a la app</a>
				</>
				: supported
					? <>
						<p>Toca el botón y pon tu huella o el bloqueo de pantalla. Elige la passkey de la misma cuenta que usas en la app.</p>
						{state === 'cancelled' && <p className="auth-error" role="alert">Se canceló la huella. Inténtalo de nuevo.</p>}
						{state === 'failed' && <p className="auth-error" role="alert">No se pudo confirmar. Revisa que tengas una passkey registrada en esta cuenta e inténtalo de nuevo.</p>}
						<button type="button" className="button" onClick={() => { void verify() }} disabled={state === 'busy'}>{state === 'busy' ? 'Esperando tu huella…' : 'Usar huella o passkey'}</button>
						<a className="text-button" href={PASSKEY_RETURN_URL}>Cancelar y volver a la app</a>
					</>
					: <>
						<p className="auth-error" role="alert">Este navegador no permite passkeys. Abre la página en Chrome o usa el código de tu autenticador.</p>
						<a className="button button-secondary" href={PASSKEY_RETURN_URL}>Volver a la app</a>
					</>}
		</section>
	</main>
}

export default VerificarHuella
