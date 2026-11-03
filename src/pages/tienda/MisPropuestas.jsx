import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import { obtenerMisPropuestas } from '../../services/propuestaService.js'
import Pagination from '../../components/Pagination.jsx'

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
  return <section className="store-requests-page"><h1>Mis propuestas</h1><p>Consulta tus cotizaciones y sigue las solicitudes, incluso después de la selección.</p>
    {loading && <p role="status">Cargando…</p>}{error && <p role="alert">{error}</p>}
    {!loading && !error && !items.length && <p>Aún no hay propuestas en esta página.</p>}
    {!loading && !error && items.map(item => <article key={item.id} className="store-request-card"><h2>{item.solicitud?.titulo || 'Solicitud no disponible'}</h2>
      <p>Estado: {item.estado.replaceAll('_', ' ')} · Solicitud: {item.solicitud?.estado?.replaceAll('_', ' ') || 'No disponible'}</p>
      <strong>{new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(item.precio))} total</strong>
      <p><Link className="button" to={`/tienda/solicitudes/${item.solicitud_id}`}>Ver seguimiento</Link></p>
    </article>)}
    <Pagination page={page} hasMore={hasMore} loading={loading} onChange={setPage} />
  </section>
}
