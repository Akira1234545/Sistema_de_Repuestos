import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authState.js'
import NotificationBell from './NotificationBell.jsx'

function ClientHeader() {
	const navigate = useNavigate()
	const { user, profile, signOut } = useAuth()
	const userLabel = profile?.nombre || user?.user_metadata?.nombre || user?.email || 'Cliente'

	async function handleSignOut() {
		if (await signOut()) navigate('/login')
	}

	return (
		<header className="client-header">
			<form className="client-search" role="search" onSubmit={event => { event.preventDefault(); navigate('/promociones?q=' + encodeURIComponent(new FormData(event.currentTarget).get('q').trim())) }}>
				<span>⌕</span>
				<input name="q" maxLength={160} type="search" placeholder="Buscar promociones..." aria-label="Buscar promociones" />
			</form>
			<div className="client-header-actions">
				<NotificationBell key={user?.id || 'anonymous'} variant="client" />
				<Link className="client-profile-link" to="/cliente">
					<span className="client-profile-label">{userLabel}</span>
					<span className="client-avatar">{userLabel.charAt(0).toUpperCase()}</span>
				</Link>
				<button className="client-logout" type="button" onClick={handleSignOut}>Cerrar sesión <span>↗</span></button>
			</div>
		</header>
	)
}

export default ClientHeader
