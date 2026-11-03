import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from './Icon.jsx'
import { useAuth } from '../context/authState.js'
import { ROLE_LABELS } from '../lib/roles.js'

// Avatar button with the account shortcuts; it is the way to sign out on phones,
// where the sidebar (and its sign-out button) becomes the bottom bar.
export default function AccountMenu({ variant = 'client' }) {
	const { user, profile, role, signOut } = useAuth()
	const navigate = useNavigate()
	const rootRef = useRef(null)
	const [open, setOpen] = useState(false)
	const [leaving, setLeaving] = useState(false)
	const name = [profile?.nombre, profile?.apellido].filter(Boolean).join(' ') || user?.email || 'Mi cuenta'
	const favorites = variant === 'store' ? '/tienda/favoritos' : '/cliente/favoritos'

	useEffect(() => {
		if (!open) return undefined
		function onPointer(event) { if (!rootRef.current?.contains(event.target)) setOpen(false) }
		function onKey(event) { if (event.key === 'Escape') setOpen(false) }
		document.addEventListener('pointerdown', onPointer)
		document.addEventListener('keydown', onKey)
		return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
	}, [open])

	async function leave() {
		setLeaving(true)
		if (await signOut()) navigate('/login', { replace: true })
		else setLeaving(false)
	}

	return <div className="account-menu" ref={rootRef}>
		<button type="button" className={`${variant}-profile-link account-menu-trigger`} aria-haspopup="menu" aria-expanded={open} aria-label="Menú de cuenta" onClick={() => setOpen((value) => !value)}>
			<span className={`${variant}-profile-label`}>{profile?.nombre || name}</span>
			<span className={`${variant === 'store' ? 'store' : 'client'}-avatar`}>{name.charAt(0).toUpperCase()}</span>
		</button>
		{open && <div className="account-menu-panel" role="menu">
			<div className="account-menu-identity"><strong>{name}</strong><span>{user?.email}</span><small>{ROLE_LABELS[role] || ''}</small></div>
			<Link role="menuitem" to="/cuenta" onClick={() => setOpen(false)}><Icon name="user" size={18} /> Mi cuenta</Link>
			<Link role="menuitem" to={favorites} onClick={() => setOpen(false)}><Icon name="heart" size={18} /> Favoritos</Link>
			<button role="menuitem" type="button" className="account-menu-logout" onClick={leave} disabled={leaving}><Icon name="logout" size={18} /> {leaving ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
		</div>}
	</div>
}
