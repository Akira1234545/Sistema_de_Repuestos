import { useRef } from 'react'
import StoreHeader from '../components/StoreHeader.jsx'
import StoreSidebar from '../components/StoreSidebar.jsx'
import PageOutlet from '../components/PageOutlet.jsx'
import { useAuth } from '../context/authState.js'
import { useViewMode } from '../hooks/useViewMode.js'
import { usePanelLens, useSidebarWidth } from '../hooks/usePanelShell.js'

function TiendaLayout() {
	const { profileError } = useAuth()
	const shellRef = useRef(null)
	const [mode, setMode] = useViewMode('sidebar', ['full', 'rail'], 'full')
	const markWidth = useSidebarWidth(shellRef, mode)
	usePanelLens(shellRef)
	function toggle(sidebar) { markWidth(sidebar); setMode(mode === 'rail' ? 'full' : 'rail') }
	return (
		<div className="store-layout panel-shell glass-scene" data-sidebar={mode} ref={shellRef}>
			<a className="skip-link" href="#contenido-tienda">Ir al contenido</a>
			<StoreHeader />
			<StoreSidebar mode={mode} onToggle={toggle} />
			<main className="store-main" id="contenido-tienda" tabIndex={-1}>
				{profileError && <p role="alert" className="store-error">{profileError}</p>}
				<PageOutlet />
			</main>
		</div>
	)
}

export default TiendaLayout
