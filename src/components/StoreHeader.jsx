import { useAuth } from '../context/authState.js'
import NotificationBell from './NotificationBell.jsx'
import GlobalSearch from './GlobalSearch.jsx'
import AccountMenu from './AccountMenu.jsx'

function StoreHeader() {
	const { user } = useAuth()
	return (
		<header className="store-header">
			<GlobalSearch className="store-search" />
			<div className="store-header-actions">
				<NotificationBell key={user?.id || 'anonymous'} variant="store" />
				<AccountMenu variant="store" />
			</div>
		</header>
	)
}

export default StoreHeader
