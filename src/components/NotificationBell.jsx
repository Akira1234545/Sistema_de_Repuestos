import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authState.js'
import { marcarNotificacionLeida, obtenerNotificaciones } from '../services/notificacionService.js'
import './NotificationBell.css'

const typeLabels = {
	nueva_propuesta: 'Nueva propuesta',
	nueva_solicitud: 'Nueva solicitud',
	propuesta_seleccionada: 'Propuesta seleccionada',
	cambio_estado_propuesta: 'Estado de propuesta',
	cambio_estado_solicitud: 'Estado de solicitud',
	promocion: 'Promoción',
}

function formatDate(value) {
	return new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function notificationPath(notification, role) {
	if (!notification.solicitud_id) return ''
	if (role === 'tienda') return `/tienda/solicitudes/${notification.solicitud_id}`
	if (role === 'cliente' && ['nueva_propuesta', 'propuesta_seleccionada', 'cambio_estado_propuesta'].includes(notification.tipo)) {
		return `/cliente/solicitudes/${notification.solicitud_id}/propuestas`
	}
	if (role === 'cliente') return '/cliente/solicitudes'
	return ''
}

function NotificationBell({ variant }) {
	const { user, role } = useAuth()
	const [open, setOpen] = useState(false)
	const [notifications, setNotifications] = useState([])
	const [loadedForUserId, setLoadedForUserId] = useState('')
	const [unreadCount, setUnreadCount] = useState(0)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [markingId, setMarkingId] = useState('')
	const containerRef = useRef(null)
	const requestVersion = useRef(0)

	const loadNotifications = useCallback(async () => {
		const userId = user?.id
		if (!userId) return
		const version = ++requestVersion.current
		setLoading(true)
		setError('')
		try {
			const result = await obtenerNotificaciones()
			if (requestVersion.current !== version) return
			setNotifications(result.notifications)
			setLoadedForUserId(userId)
			setUnreadCount(result.unreadCount)
		} catch (cause) {
			if (requestVersion.current === version) {
				setError(`No se pudieron cargar las notificaciones: ${cause.message || 'Inténtalo de nuevo.'}`)
			}
		} finally {
			if (requestVersion.current === version) setLoading(false)
		}
	}, [user?.id])

	useEffect(() => {
		requestVersion.current += 1
		if (!user?.id) return undefined
		const initialLoad = window.setTimeout(() => { void loadNotifications() }, 0)
		const refreshInterval = window.setInterval(() => { void loadNotifications() }, 60000)
		const refreshOnFocus = () => { if (document.visibilityState === 'visible') void loadNotifications() }
		window.addEventListener('focus', refreshOnFocus)
		return () => {
			requestVersion.current += 1
			window.clearTimeout(initialLoad)
			window.clearInterval(refreshInterval)
			window.removeEventListener('focus', refreshOnFocus)
		}
	}, [loadNotifications, user?.id])

	useEffect(() => {
		if (!open) return undefined
		function closeOnOutsideClick(event) {
			if (!containerRef.current?.contains(event.target)) setOpen(false)
		}
		function closeOnEscape(event) {
			if (event.key === 'Escape') setOpen(false)
		}
		document.addEventListener('pointerdown', closeOnOutsideClick)
		document.addEventListener('keydown', closeOnEscape)
		return () => {
			document.removeEventListener('pointerdown', closeOnOutsideClick)
			document.removeEventListener('keydown', closeOnEscape)
		}
	}, [open])

	const visibleNotifications = loadedForUserId === user?.id ? notifications : []
	const visibleUnreadCount = loadedForUserId === user?.id ? unreadCount : 0

	async function markRead(notification) {
		if (notification.leida || markingId) return
		setMarkingId(notification.id)
		setError('')
		try {
			await marcarNotificacionLeida(notification.id)
			setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, leida: true } : item))
			setUnreadCount((current) => Math.max(0, current - 1))
		} catch (cause) {
			setError(`No se pudo marcar como leída: ${cause.message}`)
		} finally {
			setMarkingId('')
		}
	}

	return <div className={`notification-bell notification-bell-${variant}`} ref={containerRef}>
		<button
			className={`${variant}-notifications notification-trigger`}
			type="button"
			aria-label={visibleUnreadCount ? `Notificaciones, ${visibleUnreadCount} sin leer` : 'Notificaciones'}
			aria-expanded={open}
			aria-haspopup="true"
			onClick={() => {
				const nextOpen = !open
				setOpen(nextOpen)
				if (nextOpen) void loadNotifications()
			}}
		>
			♢
			{visibleUnreadCount > 0 && <span className="notification-count">{visibleUnreadCount > 99 ? '99+' : visibleUnreadCount}</span>}
		</button>
		{open && <section className="notification-popover" aria-label="Notificaciones">
			<header className="notification-popover-header">
				<div><p>ACTIVIDAD RECIENTE</p><h2>Notificaciones</h2></div>
				<span>{visibleUnreadCount} sin leer</span>
			</header>
			{error && <p className="notification-error" role="alert">{error}</p>}
			{loading && visibleNotifications.length === 0 && !error && <p className="notification-empty" role="status">Cargando notificaciones...</p>}
			{!loading && !error && visibleNotifications.length === 0 && <p className="notification-empty">No tienes notificaciones todavía.</p>}
			{visibleNotifications.length > 0 && <ul className="notification-list">
				{visibleNotifications.map((notification) => {
					const to = notificationPath(notification, role)
					return <li className={`notification-item${notification.leida ? '' : ' notification-item-unread'}`} key={notification.id}>
						<span className="notification-item-mark" aria-hidden="true">{notification.leida ? '·' : '•'}</span>
						<div className="notification-item-content">
							<div className="notification-item-meta"><span>{typeLabels[notification.tipo] || 'Aviso'}</span><time dateTime={notification.fecha_creacion}>{formatDate(notification.fecha_creacion)}</time></div>
							<strong>{notification.titulo}</strong>
							<p>{notification.mensaje}</p>
							<div className="notification-item-actions">
								{to && <Link to={to} onClick={() => { void markRead(notification); setOpen(false) }}>Ver detalle ↗</Link>}
								{!notification.leida && <button type="button" onClick={() => markRead(notification)} disabled={Boolean(markingId)}>{markingId === notification.id ? 'Guardando…' : 'Marcar como leída'}</button>}
								{notification.leida && <span>Leída</span>}
							</div>
						</div>
					</li>
				})}
			</ul>}
			{error && <button className="notification-retry" type="button" onClick={() => { void loadNotifications() }}>Reintentar</button>}
		</section>}
	</div>
}

export default NotificationBell
