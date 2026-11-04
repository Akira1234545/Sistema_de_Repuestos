import { useAuth } from '../context/authState.js'
import NotificationBell from './NotificationBell.jsx'
import GlobalSearch from './GlobalSearch.jsx'
import AccountMenu from './AccountMenu.jsx'

function ClientHeader() {
	const { user } = useAuth()
	return (
		<header className="client-header">
			<GlobalSearch className="client-search" />
			<div className="client-header-actions">
				<NotificationBell key={user?.id || 'anonymous'} variant="client" />
				<AccountMenu variant="client" />
			</div>
		</header>
	)
}

export default ClientHeader
