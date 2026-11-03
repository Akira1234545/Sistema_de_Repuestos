import Pagination from '../../components/Pagination.jsx'
import { publicError } from '../../lib/errors.js'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import { cambiarEstadoPromocion, obtenerPromocionesDeMiTienda } from '../../services/promocionService.js'

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
	return <section className="promo-page"><header className="promo-page-heading"><div><p className="promo-eyebrow">Panel de tienda / Promociones</p><h1>Mis promociones</h1><p>Administra ofertas y periodos de vigencia.</p></div><Link className="button promo-button" to="/tienda/promociones/crear">Crear promoción</Link></header>
		{loading && <p className="promo-state">Cargando promociones…</p>}{error && <p className="promo-error" role="alert">{error}</p>}{!loading && !error && !items.length && <div className="promo-state"><h2>Aún no tienes promociones</h2><p>Publica una oferta para que los usuarios puedan consultarla.</p></div>}
		{!loading && items.length > 0 && <div className="promo-grid">{items.map((item) => <article className="promo-card" key={item.id}><p className="promo-category">{item.categoriaNombre} · {item.estado.replaceAll('_', ' ')}</p><h2>{item.titulo}</h2><p className="promo-description">{item.descripcion || 'Sin descripción adicional.'}</p><div className="promo-prices"><del>{money(item.precio_anterior)}</del><strong>{money(item.precio_oferta)}</strong><span>{Number(item.porcentaje_descuento || 0).toFixed(0)}% menos</span></div><p className="promo-dates">{date(item.fecha_inicio)} – {date(item.fecha_fin)}</p><div className="promo-actions"><Link className="button promo-button" to={`/tienda/promociones/${item.id}/editar`}>Editar</Link>{item.estado === 'activa' ? <button className="promo-secondary" type="button" disabled={Boolean(busyId)} onClick={() => changeState(item, 'pausada')}>Pausar</button> : item.estado === 'pausada' && new Date(item.fecha_fin) > new Date() ? <button className="promo-secondary" type="button" disabled={Boolean(busyId)} onClick={() => changeState(item, 'activa')}>Activar</button> : null}{item.estado !== 'finalizada' && <button className="promo-secondary" type="button" disabled={Boolean(busyId)} onClick={() => changeState(item, 'finalizada')}>Finalizar</button>}</div></article>)}</div>}
		<Pagination page={page} hasMore={hasMore} loading={loading} onChange={setPage} />
	</section>
}
export default TiendaPromociones
