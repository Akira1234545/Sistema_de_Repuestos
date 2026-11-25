import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { isNativeApp } from '../lib/platform.js'
import { legalPath } from '../lib/legal.js'

const STORAGE_KEY = 'drivefix:cookies'

function alreadySeen() {
	try { return localStorage.getItem(STORAGE_KEY) === 'esenciales' } catch { return false }
}

// Aviso de cookies (sesión 8). DriveFix solo usa almacenamiento esencial, así que no hay nada que
// «rechazar»: el aviso informa, enlaza la política y se recuerda al cerrarlo.
export default function CookieNotice() {
	const { pathname } = useLocation()
	const [open, setOpen] = useState(() => !isNativeApp && !alreadySeen())
	if (!open || pathname.startsWith('/legal/') || pathname === '/verificar-huella') return null
	function accept() {
		try { localStorage.setItem(STORAGE_KEY, 'esenciales') } catch { /* modo privado: se volverá a mostrar */ }
		setOpen(false)
	}
	return <section className="cookie-notice" role="region" aria-label="Aviso de cookies">
		<p><strong>Solo usamos lo esencial.</strong> Guardamos tu sesión y tus preferencias en este navegador. Sin publicidad ni analítica. <Link to={legalPath('cookies')}>Ver política de cookies</Link></p>
		<button type="button" className="button button-secondary" onClick={accept}>Entendido</button>
	</section>
}
