import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { obtenerResenasPublicasDeTiendas } from '../services/resenaService.js'
import { obtenerTiendasPublicas } from '../services/tiendaService.js'
import PublicReviews from '../components/PublicReviews.jsx'
import './TiendasPublicas.css'

export default function TiendasPublicas() {
  const { hash } = useLocation()
  const focusId = /^#[0-9a-f-]{36}$/i.test(hash) ? hash.slice(1) : ''
  const [stores, setStores] = useState([])
  const [reviewsByStore, setReviewsByStore] = useState({})
  const [summaries, setSummaries] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search); setPage(0) }, 250)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true); setError(''); setReviewError('')
      try {
        const result = await obtenerTiendasPublicas(page, query, focusId)
        if (!active) return
        setStores(result.items); setHasMore(result.hasMore)
        setReviewsByStore({}); setSummaries({})
        try {
          const { reviews, summaries } = await obtenerResenasPublicasDeTiendas(result.items.map(store => store.id))
          if (!active) return
          setSummaries(summaries)
          setReviewsByStore(reviews.reduce((groups, review) => { (groups[review.tienda_id] ||= []).push(review); return groups }, {}))
        } catch { if (active) setReviewError('No se pudieron consultar las reseñas. Vuelve a cargar la página para reintentar.') }
      } catch { if (active) setError('No se pudieron cargar las tiendas. Comprueba tu conexión y vuelve a intentarlo.') }
      finally { if (active) setLoading(false) }
    }
    const timer = setTimeout(() => { void load() }, 0)
    return () => { active = false; clearTimeout(timer) }
  }, [page, query, focusId])
  return <main className="public-stores-page">
    <header className="public-stores-heading"><p className="eyebrow">RepuestosPro / Tiendas aprobadas</p><h1>Encuentra tu tienda de repuestos</h1>
      <p>Consulta perfiles y reseñas. El teléfono se comparte en promociones y la ubicación al seleccionar una propuesta.</p><Link to="/">Volver al inicio</Link></header>
    <label>Buscar por nombre<input type="search" maxLength={160} value={search} onChange={event => setSearch(event.target.value)} /></label>
    {focusId && <p><Link to="/tiendas">Ver todas las tiendas</Link></p>}
    {loading && <p role="status">Cargando tiendas…</p>}
    {error && <p className="public-stores-error" role="alert">{error}</p>}
    {reviewError && <p className="public-stores-error" role="alert">{reviewError}</p>}
    {!loading && !error && !stores.length && <p>No hay tiendas que coincidan con tu búsqueda.</p>}
    {!loading && !error && <div className="public-stores-grid">{stores.map(store => <article className="public-store-card" id={store.id} key={store.id}>
      {store.fotografias?.[0] ? <img src={store.fotografias[0]} width="640" height="400" loading="lazy" alt={`Imagen de ${store.nombre}`} /> : <div className="public-store-placeholder" aria-hidden="true">R</div>}
      <div className="public-store-copy"><p className="public-store-label">Tienda aprobada</p><h2>{store.nombre}</h2><p>{store.descripcion || 'Tienda de repuestos.'}</p>{store.horario && <small>Horario: {store.horario}</small>}
        <PublicReviews storeId={store.id} storeName={store.nombre} initial={reviewsByStore[store.id] || []} summary={summaries[store.id]} error={reviewError} />
      </div>
    </article>)}</div>}
    {!focusId && <nav className="admin-pagination" aria-label="Páginas de tiendas"><button className="button button-secondary" disabled={loading || page === 0} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page + 1}</span><button className="button button-secondary" disabled={loading || !hasMore} onClick={() => setPage(page + 1)}>Siguiente</button></nav>}
  </main>
}
