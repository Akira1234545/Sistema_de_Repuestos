import { useRef } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../Icon.jsx'
import BrandLogo from '../BrandLogo.jsx'
import { useAuth } from '../../context/authState.js'
import { SIGN_OUT_CONFIRM, useConfirm } from '../../context/confirmState.js'
import { useBottomBar } from '../../hooks/useBottomBar.js'
import { useSlidingPill } from '../../hooks/usePanelShell.js'
import { ROLE_LABELS } from '../../lib/roles.js'
import { OPEN_SEARCH_EVENT } from '../../lib/events.js'

// Dark glass sidebar shared by the client and store panels (sesión 7).
// Desktop: rail (76 px, icons + tooltip) ↔ full (264 px) with grouped links and a sliding pill.
// ≤ 860 px: the same <nav> becomes the bottom bar (groups flatten, the pill keeps sliding).
export default function PanelSidebar({ variant, label, homeTo, title, subtitle, groups, badges = {}, mode, onToggle, footer }) {
	const navigate = useNavigate()
	const { pathname } = useLocation()
	const { profile, user, role, signOut } = useAuth()
	const confirm = useConfirm()
	const asideRef = useRef(null)
	const navRef = useRef(null)
	useBottomBar(navRef)
	const capturePill = useSlidingPill(navRef, pathname)
	const rail = mode === 'rail'
	const name = [profile?.nombre, profile?.apellido].filter(Boolean).join(' ') || user?.email || 'Mi cuenta'

	async function handleSignOut() {
		if (!(await confirm(SIGN_OUT_CONFIRM))) return
		if (await signOut()) navigate('/login')
	}

	return <aside className={`${variant}-sidebar panel-sidebar section-dark`} aria-label={label} ref={asideRef} data-mode={mode}>
		<div className="panel-sidebar-top">
			<Link className="panel-sidebar-brand" to={homeTo} aria-label={`DriveFix · ${title || label}`}>
				<BrandLogo variant="dark" compact={rail} decorative />
			</Link>
			<div className="panel-sidebar-identity">
				<strong>{title}</strong>
				{subtitle && <span>{subtitle}</span>}
			</div>
			<button className="panel-sidebar-search" type="button" onClick={() => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))} aria-label="Buscar (Ctrl K)" data-label="Buscar">
				<Icon name="search" size={18} />
				<span className="panel-sidebar-search-text">Buscar…</span>
				<kbd>Ctrl K</kbd>
			</button>
		</div>

		<nav className={`${variant}-navigation panel-nav`} ref={navRef} aria-label={`Secciones de ${variant === 'store' ? 'tienda' : 'cliente'}`} onClickCapture={capturePill}>
			{groups.map((group, groupIndex) => <div className="panel-nav-group" key={group.title} role="group" aria-labelledby={`${variant}-group-${groupIndex}`}>
				<p className="panel-nav-group-title" id={`${variant}-group-${groupIndex}`}>{group.title}</p>
				{group.items.map((item) => {
					const badge = Number(badges[item.to]) || 0
					return <NavLink className={`${variant}-navigation-link panel-nav-link${item.desktopOnly ? ' is-desktop-only' : ''}`} to={item.to} end={item.end} key={item.to} data-label={item.label}>
						{({ isActive }) => <>
							{isActive && <span className="panel-nav-pill" data-flip-id={`${variant}-nav-pill`} aria-hidden="true" />}
							<span className={`${variant}-navigation-icon panel-nav-icon`}><Icon name={item.icon} /></span>
							{/* Q12: en la barra inferior del móvil se ve la etiqueta corta; el lector de pantalla oye la completa. */}
							<span className="panel-nav-label">{item.shortLabel
								? <><span className="panel-nav-label-full">{item.label}</span><span className="panel-nav-label-short" aria-hidden="true">{item.shortLabel}</span></>
								: item.label}</span>
							{badge > 0 && <span className="panel-nav-badge"><span aria-hidden="true">{badge > 99 ? '99+' : badge}</span><span className="visually-hidden">, {badge} {item.badgeLabel || 'nuevas'}</span></span>}
						</>}
					</NavLink>
				})}
			</div>)}
		</nav>

		<div className="panel-sidebar-footer">
			{footer}
			<div className="panel-sidebar-user">
				<span className="panel-sidebar-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
				<span className="panel-sidebar-user-text"><strong>{profile?.nombre || name}</strong><small>{ROLE_LABELS[role] || ''}</small></span>
				<button className="panel-sidebar-icon-button" type="button" onClick={handleSignOut} aria-label="Cerrar sesión" data-label="Cerrar sesión"><Icon name="logout" size={18} /></button>
			</div>
			<button className="panel-sidebar-toggle" type="button" onClick={() => onToggle(asideRef.current)} aria-pressed={rail} aria-label={rail ? 'Expandir menú lateral' : 'Contraer menú lateral'} title={rail ? 'Expandir menú' : 'Contraer menú'}>
				<Icon name="chevron" size={16} />
			</button>
		</div>
	</aside>
}
