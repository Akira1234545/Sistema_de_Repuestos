import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authState.js'
import NotificationBell from './NotificationBell.jsx'

function StoreHeader() {
	const navigate = useNavigate()
	const { user, profile, signOut } = useAuth()
	const userLabel = profile?.nombre || user?.email || 'Tienda'

	async function handleSignOut() {
		if (await signOut()) navigate('/login')
	}

	return (
		<header className="store-header">
			<form className="store-search" role="search" onSubmit={event => { event.preventDefault(); navigate('/promociones?q=' + encodeURIComponent(new FormData(event.currentTarget).get('q').trim())) }}>
				<span>⌕</span>
				<input name="q" maxLength={160} type="search" placeholder="Buscar promociones..." aria-label="Buscar promociones" />
			</form>
			<div className="store-header-actions">
				<NotificationBell key={user?.id || 'anonymous'} variant="store" />
				<Link className="store-profile-link" to="/cuenta" aria-label="Mi cuenta">
					<span className="store-profile-label">{userLabel}</span>
					<span className="store-avatar">{userLabel.charAt(0).toUpperCase()}</span>
				</Link>
				<button className="store-logout" type="button" onClick={handleSignOut}>
					Cerrar sesión <span>↗</span>
				</button>
			</div>
		</header>
	)
}

export default StoreHeader
