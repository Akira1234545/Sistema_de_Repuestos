import { useEffect, useState } from 'react'
import SkeletonList from '../../components/ui/Skeleton.jsx'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import { obtenerMisPropuestas } from '../../services/propuestaService.js'
import Pagination from '../../components/Pagination.jsx'
import { money, statusLabel } from '../../lib/format.js'

const proposalLabels = { enviada: 'Enviada', aceptada: 'Seleccionada', rechazada: 'No seleccionada', retirada: 'Retirada' }
const label = statusLabel

export default function MisPropuestas() {
	const { user } = useAuth()
	const [page, setPage] = useState(0)
	const [items, setItems] = useState([])
	const [hasMore, setHasMore] = useState(false)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	useEffect(() => {
		let active = true
		async function load() {
			setLoading(true); setError('')
			try {
				const result = await obtenerMisPropuestas(user.id, page)
				if (active) { setItems(result.items); setHasMore(result.hasMore) }
			} catch { if (active) setError('No se pudieron cargar tus propuestas. Reintenta en unos momentos.') }
			finally { if (active) setLoading(false) }
		}
		const timer = setTimeout(() => { void load() }, 0)
		return () => { active = false; clearTimeout(timer) }
	}, [user.id, page])

	return <section className="store-requests-page">
		<div className="store-requests-heading">
			<div><p className="store-eyebrow">Panel de tienda / Cotizaciones</p><h1>Mis propuestas</h1><p className="store-requests-lead">Consulta tus cotizaciones y sigue cada solicitud, incluso después de la selección.</p></div>
			<Link className="button" to="/tienda/solicitudes">Buscar solicitudes</Link>
		</div>
		{loading && <SkeletonList label="Cargando propuestas…" />}
		{error && <p className="store-request-error" role="alert">{error}</p>}
		{!loading && !error && !items.length && <div className="store-request-empty">
			<h2>{page ? 'No hay más propuestas' : 'Aún no enviaste propuestas'}</h2>
			<p>Revisa las solicitudes disponibles para tus categorías y envía tu primera cotización.</p>
			<Link className="button" to="/tienda/solicitudes">Ver solicitudes disponibles</Link>
		</div>}
		{!loading && !error && items.length > 0 && <div className="store-request-list">{items.map(item => <article key={item.id} className="store-request-card my-proposal-card">
			<div className="store-request-top">
				<div>
					<span className="store-request-number">Solicitud{item.solicitud?.estado ? ` · ${label(item.solicitud.estado)}` : ''}</span>
					<h2>{item.solicitud?.titulo || 'Solicitud no disponible'}</h2>
				</div>
				<span className={`proposal-status proposal-status-${item.estado}`}>{proposalLabels[item.estado] || label(item.estado)}</span>
			</div>
			<strong className="proposal-price">{money(item.precio)}</strong>
			<div className="store-request-footer">
				<span className="store-request-date">Precio total por la cantidad solicitada</span>
				<Link className="store-request-link" to={`/tienda/solicitudes/${item.solicitud_id}`}>Ver seguimiento →</Link>
			</div>
		</article>)}</div>}
		<Pagination page={page} hasMore={hasMore} loading={loading} onChange={setPage} />
	</section>
}
