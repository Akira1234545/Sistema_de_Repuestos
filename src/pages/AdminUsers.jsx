import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/authState.js'
import { cambiarEstadoUsuario, obtenerUsuariosAdministracion } from '../services/adminService.js'

function formatDate(value) {
	return value ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(new Date(value)) : 'Sin fecha'
}

function AdminUsers() {
	const { user, role } = useAuth()
	const [users, setUsers] = useState([])
	const [filter, setFilter] = useState('')
	const [loading, setLoading] = useState(true)
	const [busyId, setBusyId] = useState('')
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')

	const loadUsers = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			setUsers(await obtenerUsuariosAdministracion())
		} catch (cause) {
			setError(`No se pudieron cargar los usuarios: ${cause.message}`)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		const timer = window.setTimeout(() => { void loadUsers() }, 0)
		return () => window.clearTimeout(timer)
	}, [loadUsers])

	const visibleUsers = useMemo(() => {
		const term = filter.trim().toLocaleLowerCase()
		if (!term) return users
		return users.filter((account) => [
			account.nombre, account.apellido, account.telefono, account.correo, account.rol, account.id,
		].some((value) => value?.toLocaleLowerCase().includes(term)))
	}, [filter, users])

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
			setError(`No se pudo cambiar el estado de la cuenta: ${cause.message}`)
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
		<label className="admin-user-search">Buscar usuario<input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Nombre, correo, teléfono, rol o ID" /></label>
		{loading ? <p role="status">Cargando usuarios…</p> : visibleUsers.length === 0
			? <section className="admin-empty"><h3>No hay usuarios para mostrar</h3><p>Prueba otra búsqueda.</p></section>
			: <div className="admin-user-list">{visibleUsers.map((account) => {
				const isSelf = account.id === user?.id
				const protectedSuperAdmin = account.rol === 'superAdministrador' && role !== 'superAdministrador'
				const cannotChange = isSelf || protectedSuperAdmin
				return <article className="admin-user-card" key={account.id}>
					<div className="admin-user-details">
						<div className="admin-user-title"><div><h3>{account.nombre} {account.apellido}</h3><p>{account.correo || 'Correo no disponible'}</p></div><span className={`admin-user-state${account.activo ? ' is-active' : ''}`}>{account.activo ? 'Activa' : 'Inactiva'}</span></div>
						<dl><div><dt>Rol</dt><dd>{account.rol}</dd></div><div><dt>Teléfono</dt><dd>{account.telefono || 'No registrado'}</dd></div><div><dt>Registro</dt><dd>{formatDate(account.fecha_creacion)}</dd></div></dl>
					</div>
					<button className={`button ${account.activo ? 'button-danger' : 'button-primary'}`} type="button" onClick={() => { void toggleActive(account) }} disabled={Boolean(busyId) || cannotChange}>
						{busyId === account.id ? 'Guardando…' : account.activo ? 'Desactivar cuenta' : 'Activar cuenta'}
					</button>
					{isSelf && <small className="admin-user-hint">No puedes cambiar el estado de tu propia cuenta.</small>}
					{protectedSuperAdmin && <small className="admin-user-hint">Solo un superadministrador puede cambiar esta cuenta.</small>}
				</article>
			})}</div>}
	</section>
}

export default AdminUsers
