import { Outlet } from 'react-router-dom'
import ClientHeader from '../components/ClientHeader.jsx'
import ClientSidebar from '../components/ClientSidebar.jsx'
import './ClienteLayout.css'

function ClienteLayout() {
	return (
		<div className="client-layout">
			<ClientHeader />
			<ClientSidebar />
			<main className="client-main">
				<Outlet />
			</main>
		</div>
	)
}

export default ClienteLayout
