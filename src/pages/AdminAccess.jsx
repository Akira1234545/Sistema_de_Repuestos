import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authState.js'
import { supabase } from '../services/supabase.js'
import './AdminAccess.css'

const statuses = ['pendiente', 'aprobada', 'rechazada', 'suspendida']
const columns = 'id, nombre, descripcion, telefono, direccion, latitud, longitud, horario, fotografias, activa, estado, motivo_estado, fecha_creacion, usuario_id'

function formatDate(value) {
	return value ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Sin fecha'
}

function AdminAccess() {
	const { role } = useAuth()
	const [stores, setStores] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [busyId, setBusyId] = useState('')
	const [filter, setFilter] = useState({ status: 'pendiente', search: '' })
	const [reasons, setReasons] = useState({})

	const loadStores = useCallback(async () => {
		setLoading(true)
		setError('')
		const { data, error: loadError } = await supabase.from('tiendas').select(columns).order('fecha_creacion', { ascending: false })
		if (loadError) setError(`No se pudieron cargar las tiendas: ${loadError.message}`)
		else setStores(data || [])
		setLoading(false)
	}, [])

	useEffect(() => { const timer = setTimeout(() => loadStores(), 0); return () => clearTimeout(timer) }, [loadStores])

	const visibleStores = useMemo(() => stores.filter((store) => {
		const term = filter.search.trim().toLocaleLowerCase()
		return (!filter.status || store.estado === filter.status)
			&& (!term || [store.nombre, store.telefono, store.direccion, store.motivo_estado].some((value) => value?.toLocaleLowerCase().includes(term)))
	}), [stores, filter])

	async function review(store, action) {
		const reason = reasons[store.id] || ''
		if (['rechazar', 'suspender'].includes(action) && !reason.trim()) {
			setError('Escribe el motivo antes de rechazar o suspender una tienda.')
			return
		}
		setBusyId(store.id); setError(''); setNotice('')
		const { error: reviewError } = await supabase.rpc('sprint1_admin_review_store', {
			p_store_id: store.id, p_action: action, p_reason: reason.trim() || null,
		})
		if (reviewError) setError(`No se pudo actualizar la tienda: ${reviewError.message}`)
		else { setNotice(`La tienda “${store.nombre}” fue ${action === 'aprobar' ? 'aprobada' : action === 'rechazar' ? 'rechazada' : 'suspendida'}.`); await loadStores() }
		setBusyId('')
	}

	return <main className="admin-page">
		<header className="admin-heading"><div><p className="eyebrow">Sistema Repuestos / Administración</p><h1>Revisión de tiendas</h1><p>Sesión administrativa verificada ({role}). Las tiendas nuevas permanecen pendientes hasta su aprobación.</p></div><Link className="button button-secondary" to="/">Volver al inicio</Link></header>
		{error && <p className="admin-alert" role="alert">{error}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
		<div className="admin-filters"><label>Estado<select value={filter.status} onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value }))}><option value="">Todos</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label><label>Buscar<input value={filter.search} onChange={(event) => setFilter((current) => ({ ...current, search: event.target.value }))} placeholder="Tienda, teléfono o dirección" /></label><button type="button" className="button button-secondary" onClick={loadStores} disabled={loading}>Actualizar</button></div>
		{loading ? <p role="status">Cargando tiendas…</p> : visibleStores.length === 0 ? <section className="admin-empty"><h2>No hay tiendas para mostrar</h2><p>Prueba con otro estado o término de búsqueda.</p></section> : <div className="admin-store-list">{visibleStores.map((store) => <article className="admin-store-card" key={store.id}>
			<div className="admin-store-top"><div><span className={`admin-status admin-status-${store.estado}`}>{store.estado}</span><h2>{store.nombre}</h2><small>Registro: {formatDate(store.fecha_creacion)}</small></div><strong>{store.activa ? 'Activa' : 'Inactiva'}</strong></div>
			<p>{store.descripcion || 'Sin descripción.'}</p><dl><div><dt>Teléfono</dt><dd>{store.telefono || 'No registrado'}</dd></div><div><dt>Dirección</dt><dd>{store.direccion || 'No registrada'}</dd></div><div><dt>Horario</dt><dd>{store.horario || 'No registrado'}</dd></div><div><dt>Ubicación</dt><dd>{store.latitud != null && store.longitud != null ? `${store.latitud}, ${store.longitud}` : 'No registrada'}</dd></div></dl>
			{store.motivo_estado && <p className="admin-reason"><strong>Último motivo:</strong> {store.motivo_estado}</p>}
			{store.estado !== 'aprobada' && <label className="admin-reason-field">Motivo (obligatorio para rechazo o suspensión)<textarea value={reasons[store.id] || ''} onChange={(event) => setReasons((current) => ({ ...current, [store.id]: event.target.value }))} rows="2" maxLength="500" /></label>}
			<div className="admin-actions"><button className="button button-primary" type="button" onClick={() => review(store, 'aprobar')} disabled={Boolean(busyId)}>{busyId === store.id ? 'Guardando…' : 'Aprobar'}</button>{store.estado !== 'rechazada' && <button className="button button-secondary" type="button" onClick={() => review(store, 'rechazar')} disabled={Boolean(busyId)}>Rechazar</button>}{store.estado !== 'suspendida' && <button className="button button-danger" type="button" onClick={() => review(store, 'suspender')} disabled={Boolean(busyId)}>Suspender</button>}</div>
		</article>)}</div>}
	</main>
}

export default AdminAccess
