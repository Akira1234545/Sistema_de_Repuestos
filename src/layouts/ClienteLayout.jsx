import { Outlet } from 'react-router-dom'
import ClientHeader from '../components/ClientHeader.jsx'
import ClientSidebar from '../components/ClientSidebar.jsx'
import './ClienteLayout.css'
import { useAuth } from '../context/authState.js'

function ClienteLayout() {
	const { profileError } = useAuth()
	return (
		<div className="client-layout">
			<a className="skip-link" href="#contenido-cliente">Ir al contenido</a>
			<ClientHeader />
			<ClientSidebar />
			<main className="client-main" id="contenido-cliente" tabIndex={-1}>
				{profileError && <p role="alert" className="request-error">{profileError}</p>}
				<Outlet />
			</main>
		</div>
	)
}

export default ClienteLayout
