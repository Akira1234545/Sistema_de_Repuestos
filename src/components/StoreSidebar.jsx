import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import PanelSidebar from './panel/PanelSidebar.jsx'
import Icon from './Icon.jsx'
import { useAuth } from '../context/authState.js'
import { obtenerResumenTienda } from '../services/dashboardService.js'
import { obtenerTiendaUsuario } from '../services/tiendaService.js'
import { REFRESH_EVENT, PANEL_BADGES_EVENT } from '../lib/events.js'

const storeGroups = [
	{ title: 'Principal', items: [
		{ label: 'Resumen', icon: 'home', to: '/tienda', end: true },
		{ label: 'Solicitudes', icon: 'requests', to: '/tienda/solicitudes', badgeLabel: 'solicitudes sin responder' },
		{ label: 'Mis propuestas', icon: 'proposal', to: '/tienda/propuestas' },
	] },
	{ title: 'Mi tienda', items: [
		{ label: 'Promociones', icon: 'promotion', to: '/tienda/promociones' },
		{ label: 'Reseñas', icon: 'star', to: '/tienda/resenas' },
		{ label: 'Mi tienda', icon: 'store', to: '/tienda/perfil' },
		{ label: 'Categorías', icon: 'categories', to: '/tienda/categorias' },
		{ label: 'Favoritos', icon: 'heart', to: '/tienda/favoritos' },
	] },
	{ title: 'Cuenta', items: [
		{ label: 'Mi cuenta', icon: 'user', to: '/cuenta', desktopOnly: true },
	] },
]

function StoreSidebar({ mode, onToggle }) {
	const { user } = useAuth()
	const { pathname } = useLocation()
	const [storeName, setStoreName] = useState('')
	const [fresh, setFresh] = useState(0)
	const [revision, setRevision] = useState(0)

	useEffect(() => {
		const refresh = () => setRevision((value) => value + 1)
		window.addEventListener(REFRESH_EVENT, refresh)
		window.addEventListener(PANEL_BADGES_EVENT, refresh)
		return () => { window.removeEventListener(REFRESH_EVENT, refresh); window.removeEventListener(PANEL_BADGES_EVENT, refresh) }
	}, [])
	useEffect(() => {
		let active = true
		if (user?.id) obtenerTiendaUsuario(user.id).then((store) => { if (active) setStoreName(store?.nombre || '') }).catch(() => {})
		return () => { active = false }
	}, [user?.id, revision])
	// Badge on «Solicitudes»: open requests in this store's categories it has not answered.
	useEffect(() => {
		let active = true
		obtenerResumenTienda().then((stats) => { if (active) setFresh(Number(stats?.solicitudes_nuevas) || 0) }).catch(() => {})
		return () => { active = false }
	}, [pathname, revision])

	return <PanelSidebar variant="store" label="Menú de tienda" homeTo="/tienda"
		title={storeName || 'Mi tienda'} subtitle="Panel de tienda"
		groups={storeGroups} badges={{ '/tienda/solicitudes': fresh }} mode={mode} onToggle={onToggle}
		footer={<Link className="panel-sidebar-link" to="/tienda/editar" data-label="Editar información"><Icon name="edit" size={18} /><span>Editar información</span></Link>} />
}

export default StoreSidebar
