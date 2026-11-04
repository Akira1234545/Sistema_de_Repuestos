import { useEffect, useState } from 'react'
import SkeletonList from '../../components/ui/Skeleton.jsx'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import { obtenerMisPropuestas } from '../../services/propuestaService.js'
import Pagination from '../../components/Pagination.jsx'
import { money, statusLabel } from '../../lib/format.js'
import Icon from '../../components/Icon.jsx'

const proposalLabels = { enviada: 'Enviada', aceptada: 'Seleccionada', rechazada: 'No seleccionada', retirada: 'Retirada' }
const label = statusLabel
const shortDate = (value) => new Intl.DateTimeFormat('es-BO', { timeZone: 'America/La_Paz', day: 'numeric', month: 'short' }).format(new Date(value))

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

	return <section className="store-requests-page requests-page-compact">
		<div className="requests-heading">
			<div><p className="store-eyebrow">Panel de tienda / Cotizaciones</p><h1>Mis propuestas</h1></div>
			<Link className="button" to="/tienda/solicitudes"><Icon name="search" size={18} /> Buscar</Link>
		</div>
		{loading && <SkeletonList label="Cargando propuestas…" />}
		{error && <p className="store-request-error" role="alert">{error}</p>}
		{!loading && !error && !items.length && <div className="store-request-empty">
			<h2>{page ? 'No hay más propuestas' : 'Aún no enviaste propuestas'}</h2>
			<p>Revisa las solicitudes disponibles para tus categorías y envía tu primera cotización.</p>
			<Link className="button" to="/tienda/solicitudes">Ver solicitudes disponibles</Link>
		</div>}
		{!loading && !error && items.length > 0 && <div className="compact-rows">{items.map(item => <Link key={item.id} className="compact-row" to={`/tienda/solicitudes/${item.solicitud_id}`}>
			<span className="compact-row-text">
				<strong>{item.solicitud?.titulo || 'Solicitud no disponible'}</strong>
				<span>{[item.solicitud?.cantidad && `x${item.solicitud.cantidad}`, `Enviada ${shortDate(item.fecha_creacion)}`].filter(Boolean).join(' · ')}</span>
			</span>
			<span className="compact-row-end">
				<strong className="compact-row-price">{money(item.precio)}</strong>
				<span className={`proposal-status proposal-status-${item.estado}`}>{proposalLabels[item.estado] || label(item.estado)}</span>
			</span>
			<span className="request-card-chevron" aria-hidden="true"><Icon name="chevron" size={16} /></span>
		</Link>)}</div>}
		<Pagination page={page} hasMore={hasMore} loading={loading} onChange={setPage} />
	</section>
}
