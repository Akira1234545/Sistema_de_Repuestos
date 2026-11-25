import { useRef } from 'react'
import ClientHeader from '../components/ClientHeader.jsx'
import ClientSidebar from '../components/ClientSidebar.jsx'
import PageOutlet from '../components/PageOutlet.jsx'
import { useAuth } from '../context/authState.js'
import { useViewMode } from '../hooks/useViewMode.js'
import { usePanelLens, useSidebarWidth } from '../hooks/usePanelShell.js'

function ClienteLayout() {
	const { profileError } = useAuth()
	const shellRef = useRef(null)
	const [mode, setMode] = useViewMode('sidebar', ['full', 'rail'], 'full')
	const markWidth = useSidebarWidth(shellRef, mode)
	usePanelLens(shellRef)
	function toggle(sidebar) { markWidth(sidebar); setMode(mode === 'rail' ? 'full' : 'rail') }
	return (
		<div className="client-layout panel-shell glass-scene" data-sidebar={mode} ref={shellRef}>
			<a className="skip-link" href="#contenido-cliente">Ir al contenido</a>
			<ClientHeader />
			<ClientSidebar mode={mode} onToggle={toggle} />
			<main className="client-main" id="contenido-cliente" tabIndex={-1}>
				{profileError && <p role="alert" className="request-error">{profileError}</p>}
				<PageOutlet />
			</main>
		</div>
	)
}

export default ClienteLayout
