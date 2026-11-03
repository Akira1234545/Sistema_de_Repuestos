import { Outlet } from 'react-router-dom'
import StoreHeader from '../components/StoreHeader.jsx'
import StoreSidebar from '../components/StoreSidebar.jsx'
import './TiendaLayout.css'
import { useAuth } from '../context/authState.js'

function TiendaLayout() {
	const { profileError } = useAuth()
	return (
		<div className="store-layout">
			<a className="skip-link" href="#contenido-tienda">Ir al contenido</a>
			<StoreHeader />
			<StoreSidebar />
			<main className="store-main" id="contenido-tienda" tabIndex={-1}>
				{profileError && <p role="alert" className="store-error">{profileError}</p>}
				<Outlet />
			</main>
		</div>
	)
}

export default TiendaLayout
