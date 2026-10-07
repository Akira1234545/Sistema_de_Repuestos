import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import { cambiarEstadoPromocion, obtenerPromocionesDeMiTienda } from '../../services/promocionService.js'
import '../Promociones.css'

function money(value) { return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value)) }
function date(value) { return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value)) }
function TiendaPromociones() {
	const { user } = useAuth()
	const [items, setItems] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [busyId, setBusyId] = useState('')
	const [reload, setReload] = useState(0)
	useEffect(() => {
		let active = true
		obtenerPromocionesDeMiTienda(user.id).then((data) => { if (active) setItems(data) }).catch((cause) => { if (active) setError(`No se pudieron cargar tus promociones: ${cause.message}`) }).finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [user.id, reload])
	async function changeState(item, estado) {
		setBusyId(item.id); setError('')
		try { await cambiarEstadoPromocion(item.id, estado); setReload((value) => value + 1) }
		catch (cause) { setError(cause.message) }
		finally { setBusyId('') }
	}
	return <main className="promo-page"><header className="promo-page-heading"><div><p className="promo-eyebrow">Panel de tienda / HU-11</p><h1>Mis promociones</h1><p>Administra ofertas y periodos de vigencia.</p></div><Link className="button promo-button" to="/tienda/promociones/crear">Crear promoción</Link></header>
		{loading && <p className="promo-state">Cargando promociones…</p>}{error && <p className="promo-error" role="alert">{error}</p>}{!loading && !items.length && <div className="promo-state"><h2>Aún no tienes promociones</h2><p>Publica una oferta para que los usuarios puedan consultarla.</p></div>}
		{!loading && items.length > 0 && <div className="promo-grid">{items.map((item) => <article className="promo-card" key={item.id}><p className="promo-category">{item.categoriaNombre} · {item.estado.replaceAll('_', ' ')}</p><h2>{item.titulo}</h2><p className="promo-description">{item.descripcion || 'Sin descripción adicional.'}</p><div className="promo-prices"><del>{money(item.precio_anterior)}</del><strong>{money(item.precio_oferta)}</strong><span>{Number(item.porcentaje_descuento || 0).toFixed(0)}% menos</span></div><p className="promo-dates">{date(item.fecha_inicio)} – {date(item.fecha_fin)}</p><div className="promo-actions"><Link className="button promo-button" to={`/tienda/promociones/${item.id}/editar`}>Editar</Link>{item.estado === 'activa' ? <button className="promo-secondary" type="button" disabled={busyId === item.id} onClick={() => changeState(item, 'pausada')}>Pausar</button> : item.estado === 'pausada' && new Date(item.fecha_fin) > new Date() ? <button className="promo-secondary" type="button" disabled={busyId === item.id} onClick={() => changeState(item, 'activa')}>Activar</button> : null}{item.estado !== 'finalizada' && <button className="promo-secondary" type="button" disabled={busyId === item.id} onClick={() => changeState(item, 'finalizada')}>Finalizar</button>}</div></article>)}</div>}
	</main>
}
export default TiendaPromociones
