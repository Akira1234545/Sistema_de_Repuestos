import Pagination from '../../components/Pagination.jsx'
import SkeletonList from '../../components/ui/Skeleton.jsx'
import { publicError } from '../../lib/errors.js'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import { cambiarEstadoPromocion, obtenerPromocionesDeMiTienda } from '../../services/promocionService.js'
import { statusLabel } from '../../lib/format.js'
import Icon from '../../components/Icon.jsx'

function money(value) { return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value)) }
function date(value) { return new Intl.DateTimeFormat('es', { timeZone: 'America/La_Paz', dateStyle: 'medium' }).format(new Date(value)) }
function TiendaPromociones() {
	const { user } = useAuth()
	const [items, setItems] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [busyId, setBusyId] = useState('')
	const [page, setPage] = useState(0)
	const [hasMore, setHasMore] = useState(false)
	useEffect(() => {
		let active = true
		Promise.resolve().then(() => { if (active) { setLoading(true); setError('') }; return obtenerPromocionesDeMiTienda(user.id, page) }).then((data) => { if (active) { setItems(data.items); setHasMore(data.hasMore) } }).catch((cause) => { if (active) setError(`No se pudieron cargar tus promociones: ${publicError(cause)}`) }).finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [user.id, page])
	async function changeState(item, estado) {
		setBusyId(item.id); setError('')
		try { const updated = await cambiarEstadoPromocion(item.id, estado); setItems(current => current.map(old => old.id === item.id ? { ...old, ...updated } : old)) }
		catch (cause) { setError(`No se pudo cambiar el estado: ${publicError(cause)}`) }
		finally { setBusyId('') }
	}
	return <section className="promo-page requests-page-compact"><div className="requests-heading"><div><p className="promo-eyebrow">Panel de tienda / Promociones</p><h1>Mis promociones</h1></div><Link className="button promo-button" to="/tienda/promociones/crear"><Icon name="plus" size={18} /> Crear</Link></div>
		{loading && <SkeletonList label="Cargando promociones…" />}{error && <p className="promo-error" role="alert">{error}</p>}{!loading && !error && !items.length && <div className="promo-state"><h2>Aún no tienes promociones</h2><p>Publica una oferta para que los clientes la vean.</p></div>}
		{!loading && items.length > 0 && <div className="compact-rows">{items.map((item) => {
			const canResume = item.estado === 'pausada' && new Date(item.fecha_fin) > new Date()
			return <article className="compact-row is-static" key={item.id}>
				<Link className="compact-row-text" to={`/promociones/${item.id}`}>
					<strong>{item.titulo}</strong>
					<span>{item.categoriaNombre} · hasta {date(item.fecha_fin)}</span>
				</Link>
				<span className="compact-row-end">
					<strong className="compact-row-price">{money(item.precio_oferta)}</strong>
					<span className={`admin-user-state admin-promotion-state-${item.estado}${item.estado === 'activa' ? ' is-active' : ''}`}>{statusLabel(item.estado)}</span>
				</span>
				<span className="compact-row-actions">
					<Link className="icon-action" to={`/tienda/promociones/${item.id}/editar`} aria-label={`Editar ${item.titulo}`} title="Editar"><Icon name="edit" size={18} /></Link>
					{item.estado === 'activa' && <button className="icon-action" type="button" disabled={Boolean(busyId)} onClick={() => changeState(item, 'pausada')} aria-label={`Pausar ${item.titulo}`} title="Pausar"><Icon name="pause" size={18} /></button>}
					{canResume && <button className="icon-action" type="button" disabled={Boolean(busyId)} onClick={() => changeState(item, 'activa')} aria-label={`Activar ${item.titulo}`} title="Activar"><Icon name="play" size={18} /></button>}
					{item.estado !== 'finalizada' && <button className="icon-action is-danger" type="button" disabled={Boolean(busyId)} onClick={() => changeState(item, 'finalizada')} aria-label={`Finalizar ${item.titulo}`} title="Finalizar"><Icon name="flag" size={18} /></button>}
				</span>
			</article>
		})}</div>}
		<Pagination page={page} hasMore={hasMore} loading={loading} onChange={setPage} />
	</section>
}
export default TiendaPromociones
