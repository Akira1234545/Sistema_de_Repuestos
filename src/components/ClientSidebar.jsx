import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import PanelSidebar from './panel/PanelSidebar.jsx'
import { useAuth } from '../context/authState.js'
import { obtenerResumenCliente } from '../services/dashboardService.js'
import { PANEL_BADGES_EVENT, REFRESH_EVENT } from '../lib/events.js'

const clientGroups = [
	{ title: 'Principal', items: [
		{ label: 'Inicio', icon: 'home', to: '/cliente', end: true },
		{ label: 'Solicitudes', icon: 'requests', to: '/cliente/solicitudes', badgeLabel: 'propuestas por revisar' },
		{ label: 'Vehículos', icon: 'vehicle', to: '/cliente/vehiculos' },
	] },
	{ title: 'Mis cosas', items: [
		{ label: 'Promociones', shortLabel: 'Promos', icon: 'promotion', to: '/promociones' },
		{ label: 'Tiendas', icon: 'store', to: '/cliente/tiendas' },
		{ label: 'Favoritos', icon: 'heart', to: '/cliente/favoritos' },
	] },
	{ title: 'Cuenta', items: [
		{ label: 'Mi cuenta', icon: 'user', to: '/cuenta', desktopOnly: true },
	] },
]

function ClientSidebar({ mode, onToggle }) {
	const { profile } = useAuth()
	const { pathname } = useLocation()
	const [pending, setPending] = useState(0)
	const [revision, setRevision] = useState(0)

	useEffect(() => {
		const refresh = () => setRevision((value) => value + 1)
		window.addEventListener(REFRESH_EVENT, refresh)
		window.addEventListener(PANEL_BADGES_EVENT, refresh)
		return () => { window.removeEventListener(REFRESH_EVENT, refresh); window.removeEventListener(PANEL_BADGES_EVENT, refresh) }
	}, [])
	// Badge on «Solicitudes»: proposals waiting for a decision. A failure just hides the badge.
	useEffect(() => {
		let active = true
		obtenerResumenCliente().then((stats) => { if (active) setPending(Number(stats?.propuestas_por_revisar) || 0) }).catch(() => {})
		return () => { active = false }
	}, [pathname, revision])

	return <PanelSidebar variant="client" label="Menú de cliente" homeTo="/cliente"
		title={profile?.nombre ? `${profile.nombre}${profile.apellido ? ` ${profile.apellido}` : ''}` : 'Mi panel'} subtitle="Panel de cliente"
		groups={clientGroups} badges={{ '/cliente/solicitudes': pending }} mode={mode} onToggle={onToggle} />
}

export default ClientSidebar
