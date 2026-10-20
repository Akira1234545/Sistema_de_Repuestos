import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { obtenerResenasPublicasDeTiendas } from '../services/resenaService.js'
import { obtenerTiendasPublicas } from '../services/tiendaService.js'
import './TiendasPublicas.css'

function TiendasPublicas() {
	const [stores, setStores] = useState([])
	const [reviewsByStore, setReviewsByStore] = useState({})
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [reviewError, setReviewError] = useState('')

	useEffect(() => {
		let active = true
		obtenerTiendasPublicas()
			.then(async (data) => {
				if (!active) return
				setStores(data)
				try {
					const reviews = await obtenerResenasPublicasDeTiendas(data.map((store) => store.id))
					if (active) {
						setReviewsByStore(reviews.reduce((grouped, review) => {
							(grouped[review.tienda_id] ||= []).push(review)
							return grouped
						}, {}))
					}
				} catch (cause) {
					if (active) setReviewError(`No se pudieron cargar las reseñas públicas: ${cause.message}`)
				}
			})
			.catch((cause) => { if (active) setError(`No se pudo cargar el catálogo de tiendas: ${cause.message}`) })
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [])

	useEffect(() => {
		if (loading || !window.location.hash) return
		const storeId = decodeURIComponent(window.location.hash.slice(1))
		document.getElementById(storeId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}, [loading, stores])

	return <main className="public-stores-page">
		<header className="public-stores-heading">
			<p className="eyebrow">RepuestosPro / Tiendas aprobadas</p>
			<h1>Encuentra una tienda para tu próximo repuesto</h1>
			<p>Explora perfiles activos. El contacto y la ubicación se muestran después de seleccionar una propuesta.</p>
			<Link to="/">Volver al inicio</Link>
		</header>
		{loading && <p className="public-stores-state">Cargando tiendas...</p>}
		{error && <p className="public-stores-error" role="alert">{error}</p>}
		{reviewError && <p className="public-stores-error" role="alert">{reviewError}</p>}
		{!loading && !error && stores.length === 0 && <div className="public-stores-state"><h2>Aún no hay tiendas disponibles</h2><p>Las tiendas aprobadas aparecerán aquí.</p></div>}
		{!loading && !error && stores.length > 0 && <div className="public-stores-grid">{stores.map((store) => <article className="public-store-card" id={store.id} key={store.id}>
			{store.fotografias?.[0] ? <img src={store.fotografias[0]} alt={`Imagen de ${store.nombre}`} /> : <div className="public-store-placeholder" aria-hidden="true">R</div>}
			<div className="public-store-copy"><p className="public-store-label">Tienda aprobada</p><h2>{store.nombre}</h2><p>{store.descripcion || 'Perfil de tienda de repuestos.'}</p>{store.horario && <small>Horario: {store.horario}</small>}
				{(() => {
					const storeReviews = reviewsByStore[store.id] || []
					const average = storeReviews.length
						? (storeReviews.reduce((sum, review) => sum + review.calificacion, 0) / storeReviews.length).toFixed(1)
						: null
					return <section className="public-store-reviews" aria-label={`Reseñas de ${store.nombre}`}>
						<h3>Calificaciones y reseñas</h3>
						<p className="public-store-rating">{reviewError ? 'Reseñas no disponibles' : <>{average && <><span aria-label={`${average} de 5`}>★ {average}</span> · </>}{storeReviews.length} {storeReviews.length === 1 ? 'reseña' : 'reseñas'}</>}</p>
						{storeReviews.length === 0 && <p>{reviewError ? 'No fue posible consultar las reseñas.' : 'Aún no hay reseñas.'}</p>}
						{storeReviews.map((review) => <article className="public-store-review" key={review.id}>
							<p className="public-store-review-stars" aria-label={`${review.calificacion} de 5 estrellas`}>{'★'.repeat(review.calificacion)}{'☆'.repeat(5 - review.calificacion)}</p>
							{review.comentario && <p className="public-store-review-comment">{review.comentario}</p>}
							<time dateTime={review.fecha_creacion}>{new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(new Date(review.fecha_creacion))}</time>
						</article>)}
					</section>
				})()}
			</div>
		</article>)}</div>}
	</main>
}

export default TiendasPublicas
