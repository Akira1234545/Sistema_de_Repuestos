import { Outlet } from 'react-router-dom'
import StoreHeader from '../components/StoreHeader.jsx'
import StoreSidebar from '../components/StoreSidebar.jsx'
import './TiendaLayout.css'

function TiendaLayout() {
	return (
		<div className="store-layout">
			<StoreHeader />
			<StoreSidebar />
			<main className="store-main">
				<Outlet />
			</main>
		</div>
	)
}

export default TiendaLayout
