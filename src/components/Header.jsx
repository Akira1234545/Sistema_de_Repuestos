import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authState.js'
import { panelPath } from '../lib/roles.js'
import BrandLogo from './BrandLogo.jsx'

function Header() {
	const navigate = useNavigate()
	const { user, role, signOut } = useAuth()
	const [scrolled, setScrolled] = useState(false)

	useEffect(() => {
		const update = () => setScrolled(window.scrollY > 8)
		update()
		window.addEventListener('scroll', update, { passive: true })
		return () => window.removeEventListener('scroll', update)
	}, [])

	async function handleSignOut() {
		if (await signOut()) navigate('/')
	}

	return (
		<header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
			<Link className="brand" to="/" aria-label="DriveFix, inicio"><BrandLogo decorative /></Link>
			<nav className="site-nav" aria-label="Navegación principal">
				<Link to="/#categorias">Categorías</Link>
				<NavLink to="/tiendas">Tiendas</NavLink>
				<NavLink to="/promociones">Promociones</NavLink>
				{user
					? <><NavLink to={panelPath(role)}>Mi panel</NavLink><button className="button button-secondary" type="button" onClick={handleSignOut}>Cerrar sesión</button></>
					: <><NavLink to="/login">Iniciar sesión</NavLink><Link className="button nav-register" to="/register">Registrarse</Link></>}
			</nav>
		</header>
	)
}

export default Header
