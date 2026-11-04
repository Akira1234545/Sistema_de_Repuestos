import Pagination from '../components/Pagination.jsx'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { publicError } from '../lib/errors.js'
import { ROLE_LABELS } from '../lib/roles.js'
import Icon from '../components/Icon.jsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/authState.js'
import { cambiarEstadoUsuario, obtenerUsuariosAdministracion } from '../services/adminService.js'

function formatDate(value) {
	return value ? new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', dateStyle: 'medium' }).format(new Date(value)) : 'Sin fecha'
}

function AdminUsers() {
	const { user, role } = useAuth()
	const [users, setUsers] = useState([])
	const [filter, setFilter] = useState('')
	const search = useDebouncedValue(filter)
	const [page, setPage] = useState(0)
	const [hasMore, setHasMore] = useState(false)
	const version = useRef(0)
	useEffect(() => () => { version.current += 1 }, [])
	const [loading, setLoading] = useState(true)
	const [busyId, setBusyId] = useState('')
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')

	const loadUsers = useCallback(async () => {
		const current = ++version.current
		setLoading(true)
		setError('')
		try {
			const result = await obtenerUsuariosAdministracion(page, search)
			if (current !== version.current) return
			setUsers(result.items); setHasMore(result.hasMore)
		} catch (cause) {
			if (current !== version.current) return
			setError(`No se pudieron cargar los usuarios: ${publicError(cause)}`)
		} finally {
			if (current === version.current) setLoading(false)
		}
	}, [page, search])

	useEffect(() => {
		const timer = window.setTimeout(() => { void loadUsers() }, 0)
		return () => window.clearTimeout(timer)
	}, [loadUsers])

	const visibleUsers = users

	async function toggleActive(account) {
		const nextActive = !account.activo
		setBusyId(account.id)
		setError('')
		setNotice('')
		try {
			await cambiarEstadoUsuario(account.id, nextActive)
			setUsers((current) => current.map((item) => item.id === account.id ? { ...item, activo: nextActive } : item))
			setNotice(`La cuenta de ${account.nombre} ${account.apellido} fue ${nextActive ? 'activada' : 'desactivada'}.`)
		} catch (cause) {
			setError(`No se pudo cambiar el estado de la cuenta: ${publicError(cause)}`)
		} finally {
			setBusyId('')
		}
	}

	return <section className="admin-panel" aria-labelledby="admin-users-title">
		<div className="admin-section-heading">
			<div><p className="admin-kicker">CUENTAS DEL SISTEMA</p><h2 id="admin-users-title">Gestión de usuarios</h2><p>Consulta perfiles, roles y estado. Desde aquí solo se cambia la activación, nunca el rol.</p></div>
			<button type="button" className="button button-secondary" onClick={() => { void loadUsers() }} disabled={loading}>Actualizar</button>
		</div>
		{error && <p className="admin-alert" role="alert">{error}</p>}
		{notice && <p className="admin-notice" role="status">{notice}</p>}
		<div className="list-toolbar"><label className="list-search"><Icon name="search" size={18} /><input type="search" value={filter} onChange={(event) => { setPage(0); setFilter(event.target.value) }} placeholder="Buscar usuario" aria-label="Buscar por nombre, correo, teléfono, rol o ID" /></label></div>
		{loading ? <p role="status">Cargando usuarios…</p> : visibleUsers.length === 0
			? <section className="admin-empty"><h3>No hay usuarios para mostrar</h3><p>Prueba otra búsqueda.</p></section>
			: <div className="admin-user-list compact-rows">{visibleUsers.map((account) => {
				const isSelf = account.id === user?.id
				const protectedSuperAdmin = account.rol === 'superAdministrador' && role !== 'superAdministrador'
				const cannotChange = isSelf || protectedSuperAdmin
				const lockReason = isSelf ? 'No puedes cambiar el estado de tu propia cuenta' : protectedSuperAdmin ? 'Solo un superadministrador puede cambiar esta cuenta' : ''
				const fullName = `${account.nombre || ''} ${account.apellido || ''}`.trim() || 'Sin nombre'
				return <article className="compact-row admin-user-row" key={account.id}>
					<span className="admin-user-avatar" aria-hidden="true">{fullName.charAt(0).toUpperCase()}</span>
					<span className="compact-row-text">
						<strong>{fullName} <span className={`admin-user-state${account.activo ? ' is-active' : ''}`}>{account.activo ? 'Activa' : 'Inactiva'}</span></strong>
						<span>{account.correo || 'Correo no disponible'}</span>
						<span>{ROLE_LABELS[account.rol] || account.rol}{account.telefono ? ` · ${account.telefono}` : ''} · {formatDate(account.fecha_creacion)}</span>
					</span>
					<button className={`icon-action${account.activo ? ' is-danger' : ''}`} type="button" onClick={() => { void toggleActive(account) }} disabled={Boolean(busyId) || cannotChange}
						aria-label={lockReason || `${account.activo ? 'Desactivar' : 'Activar'} la cuenta de ${fullName}`} title={lockReason || (account.activo ? 'Desactivar cuenta' : 'Activar cuenta')}>
						{busyId === account.id ? '…' : <Icon name={cannotChange ? 'lock' : 'power'} size={18} />}
					</button>
				</article>
			})}</div>}
		<Pagination page={page} hasMore={hasMore} loading={loading} onChange={setPage} />
	</section>
}

export default AdminUsers
