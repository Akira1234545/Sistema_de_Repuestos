import { useEffect, useId, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authState.js'
import { SIGN_OUT_CONFIRM, useConfirm } from '../context/confirmState.js'
import { publicNavLinks } from '../lib/publicNav.js'
import { useLayer } from '../lib/layers.js'
import BrandLogo from './BrandLogo.jsx'

// Encabezado público. `overlay`: se superpone a la portada y va en oscuro mientras esté
// sobre cualquier sección oscura (hero, «cómo funciona», llamada final, pie); en claro sobre las demás.
function Header({ overlay = false }) {
	const navigate = useNavigate()
	const { pathname } = useLocation()
	const { user, role, signOut } = useAuth()
	const confirm = useConfirm()
	const [scrolled, setScrolled] = useState(false)
	const [overDark, setOverDark] = useState(overlay)
	const [menuPath, setMenuPath] = useState(null)
	const menuId = useId()
	// El menú se cierra solo al cambiar de ruta: se guarda la ruta en la que se abrió.
	const open = menuPath === pathname

	useEffect(() => {
		const update = () => {
			setScrolled(window.scrollY > 8)
			if (!overlay) return
			// Sesión 8 (pendiente 3): se mira qué sección queda bajo la mitad del encabezado.
			const header = document.querySelector('.site-header')
			const probe = header ? header.getBoundingClientRect().height / 2 : 36
			const sections = document.querySelectorAll('main .section-dark, footer.section-dark')
			setOverDark([...sections].some((section) => {
				const rect = section.getBoundingClientRect()
				return rect.top <= probe && rect.bottom > probe
			}))
		}
		update()
		window.addEventListener('scroll', update, { passive: true })
		window.addEventListener('resize', update)
		return () => {
			window.removeEventListener('scroll', update)
			window.removeEventListener('resize', update)
		}
	}, [overlay])

	// E31: Escape y el botón atrás cierran el menú móvil (registro común de capas).
	useLayer(open, () => setMenuPath(null))

	async function handleSignOut() {
		setMenuPath(null)
		if (!(await confirm(SIGN_OUT_CONFIRM))) return
		if (await signOut()) navigate('/')
	}

	const dark = overlay && overDark
	const links = publicNavLinks(role, Boolean(user))
	const className = [
		'site-header',
		scrolled ? 'is-scrolled' : '',
		overlay ? 'is-overlay' : '',
		dark ? 'section-dark' : '',
		open ? 'is-open' : '',
	].filter(Boolean).join(' ')

	return (
		<header className={className}>
			<Link className="brand" to="/" aria-label="DriveFix, inicio"><BrandLogo decorative variant={dark ? 'dark' : 'light'} /></Link>
			<button
				className="site-menu-toggle"
				type="button"
				aria-expanded={open}
				aria-controls={menuId}
				onClick={() => setMenuPath(open ? null : pathname)}
			>
				<span className="site-menu-icon" aria-hidden="true"><i /><i /></span>
				<span>{open ? 'Cerrar' : 'Menú'}</span>
			</button>
			<nav className="site-nav" id={menuId} aria-label="Navegación principal">
				<ul className="site-nav-links">
					{links.map((link) => <li key={link.to}>
						{link.hash
							? <Link to={link.to} onClick={() => setMenuPath(null)}>{link.label}</Link>
							: <NavLink to={link.to} onClick={() => setMenuPath(null)}>{link.label}</NavLink>}
					</li>)}
				</ul>
				<div className="site-nav-actions">
					{user
						? <button className="button button-secondary" type="button" onClick={handleSignOut}>Cerrar sesión</button>
						: <>
							<NavLink className="site-nav-login" to="/login" onClick={() => setMenuPath(null)}>Iniciar sesión</NavLink>
							<Link className="button nav-register" to="/register" onClick={() => setMenuPath(null)}>Registrarse</Link>
						</>}
				</div>
			</nav>
		</header>
	)
}

export default Header
