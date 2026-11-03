import { useEffect, useState } from 'react'
import SkeletonList from '../components/ui/Skeleton.jsx'
import { Link, useLocation } from 'react-router-dom'
import Header from '../components/Header.jsx'
import Pagination from '../components/Pagination.jsx'
import PublicReviews from '../components/PublicReviews.jsx'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { obtenerResenasPublicasDeTiendas } from '../services/resenaService.js'
import { obtenerTiendasPublicas } from '../services/tiendaService.js'

// `embedded` renders the catalogue inside a signed-in panel instead of the public page shell.
export default function TiendasPublicas({ embedded = false }) {
	const { hash, pathname } = useLocation()
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
	const query = useDebouncedValue(search)

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
					const { reviews, summaries: loadedSummaries } = await obtenerResenasPublicasDeTiendas(result.items.map(store => store.id))
					if (!active) return
					setSummaries(loadedSummaries)
					setReviewsByStore(reviews.reduce((groups, review) => { (groups[review.tienda_id] ||= []).push(review); return groups }, {}))
				} catch { if (active) setReviewError('No se pudieron consultar las reseñas. Vuelve a cargar la página para reintentar.') }
			} catch { if (active) setError('No se pudieron cargar las tiendas. Comprueba tu conexión y vuelve a intentarlo.') }
			finally { if (active) setLoading(false) }
		}
		const timer = setTimeout(() => { void load() }, 0)
		return () => { active = false; clearTimeout(timer) }
	}, [page, query, focusId])

	const content = <>
			<header className="public-stores-heading">
				<p className="eyebrow">RepuestosPro · Tiendas aprobadas</p>
				<h1>Encuentra tu tienda de repuestos</h1>
				<p>Consulta perfiles y reseñas. El teléfono se comparte en promociones y la ubicación al seleccionar una propuesta.</p>
			</header>
			<label>Buscar por nombre<input type="search" maxLength={160} value={search} placeholder="Nombre de la tienda" onChange={event => { setPage(0); setSearch(event.target.value) }} /></label>
			{focusId && <p><Link className="text-button" to={pathname}>Ver todas las tiendas →</Link></p>}
			{loading && <SkeletonList variant="grid" label="Cargando tiendas…" />}
			{error && <p className="public-stores-error" role="alert">{error}</p>}
			{reviewError && <p className="request-history-notice" role="status">{reviewError}</p>}
			{!loading && !error && !stores.length && <div className="promo-state"><h2>No hay tiendas que coincidan</h2><p>Prueba con otro nombre o vuelve más tarde.</p></div>}
			{!loading && !error && stores.length > 0 && <div className="public-stores-grid">{stores.map(store => <article className="public-store-card" id={store.id} key={store.id}>
				{store.fotografias?.[0] ? <img src={store.fotografias[0]} width="640" height="360" loading="lazy" alt={`Fotografía de ${store.nombre}`} /> : <div className="public-store-placeholder" aria-hidden="true">{store.nombre?.charAt(0)?.toUpperCase() || 'R'}</div>}
				<div className="public-store-copy">
					<p className="public-store-label">Tienda aprobada</p>
					<h2>{store.nombre}</h2>
					<p>{store.descripcion || 'Tienda de repuestos.'}</p>
					{store.horario && <small>Horario: {store.horario}</small>}
					<PublicReviews key={`${store.id}-${(reviewsByStore[store.id] || []).length}`} storeId={store.id} storeName={store.nombre} initial={reviewsByStore[store.id] || []} summary={summaries[store.id]} error={reviewError} />
				</div>
			</article>)}</div>}
			{!focusId && <Pagination page={page} hasMore={hasMore} loading={loading} onChange={setPage} />}
	</>
	if (embedded) return <section className="public-stores-page is-embedded">{content}</section>
	return <div className="public-home">
		<a className="skip-link" href="#contenido">Ir al contenido</a>
		<Header />
		<main className="public-stores-page" id="contenido" tabIndex={-1}>{content}</main>
	</div>
}
