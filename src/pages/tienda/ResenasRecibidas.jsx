import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { obtenerResenasRecibidas } from '../../services/resenaService.js'
import './TiendaPages.css'
import './ResenasRecibidas.css'

function Stars({ rating }) {
	return <span className="received-review-stars" role="img" aria-label={`${rating} de 5 estrellas`}>
		{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
	</span>
}

function formatDate(value) {
	return new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function ResenasRecibidas() {
	const [store, setStore] = useState(null)
	const [reviews, setReviews] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		obtenerResenasRecibidas()
			.then(({ store: currentStore, reviews: receivedReviews }) => {
				if (active) {
					setStore(currentStore)
					setReviews(receivedReviews)
				}
			})
			.catch((cause) => {
				if (active) setError(`No se pudieron cargar las reseñas recibidas: ${cause.message}`)
			})
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [])

	const average = reviews.length
		? (reviews.reduce((total, review) => total + review.calificacion, 0) / reviews.length).toFixed(1)
		: '0.0'

	return <section className="store-page received-reviews-page">
		<header className="store-page-heading">
			<div>
				<p className="store-eyebrow">Panel de tienda / Opiniones</p>
				<h1>Reseñas recibidas</h1>
				<p className="store-lead">Consulta las calificaciones y comentarios que tus clientes dejaron sobre tu tienda.</p>
			</div>
			<Link className="received-reviews-back" to="/tienda"><span aria-hidden="true">←</span> Volver al panel</Link>
		</header>

		{loading && <p className="store-message" role="status">Cargando reseñas recibidas...</p>}
		{error && <p className="store-error" role="alert">{error}</p>}
		{!loading && !error && !store && <div className="store-empty">
			<h2>Primero registra tu tienda</h2>
			<p>Cuando tu cuenta tenga un perfil de tienda, aquí podrás consultar las reseñas recibidas.</p>
			<Link className="store-button" to="/tienda/editar">Registrar tienda</Link>
		</div>}
		{!loading && !error && store && <div className="received-reviews-content">
			<div className="received-reviews-store">
				<div className="received-reviews-store-mark" aria-hidden="true">R</div>
				<div><span>RESEÑAS DE TU TIENDA</span><strong>{store.nombre}</strong></div>
			</div>
			<div className="received-reviews-summary" aria-label="Resumen de reseñas">
				<div className="received-reviews-stat received-reviews-stat-rating">
					<span className="received-reviews-stat-icon" aria-hidden="true">★</span>
					<div><small>CALIFICACIÓN PROMEDIO</small><strong>{reviews.length ? average : '—'}<span className="received-reviews-out-of"> / 5</span></strong><span className="received-reviews-stat-note">{reviews.length ? 'Basada en las opiniones recibidas' : 'Aún sin calificaciones'}</span></div>
				</div>
				<div className="received-reviews-stat">
					<span className="received-reviews-stat-icon received-reviews-count-icon" aria-hidden="true">✎</span>
					<div><small>TOTAL DE RESEÑAS</small><strong>{reviews.length}</strong><span className="received-reviews-stat-note">{reviews.length === 1 ? 'opinión de tus clientes' : 'opiniones de tus clientes'}</span></div>
				</div>
			</div>
			{reviews.length === 0
				? <div className="received-reviews-empty">
					<span className="received-reviews-empty-icon" aria-hidden="true">☆</span>
					<h2>Todavía no has recibido reseñas</h2>
					<p>Cuando un cliente seleccione una de tus propuestas y deje su opinión, aparecerá aquí.</p>
				</div>
				: <section className="received-reviews-section" aria-labelledby="received-reviews-list-title">
					<div className="received-reviews-section-heading"><div><p className="store-eyebrow">OPINIONES DE CLIENTES</p><h2 id="received-reviews-list-title">Todas las reseñas</h2></div><span>{reviews.length} {reviews.length === 1 ? 'reseña' : 'reseñas'}</span></div>
					<div className="received-reviews-list">{reviews.map((review) => <article className="received-review-card" key={review.id}>
						<div className="received-review-avatar" aria-hidden="true">
							{`${review.nombre_cliente?.[0] || ''}${review.apellido_cliente?.[0] || ''}`.toLocaleUpperCase() || 'C'}
						</div>
						<div className="received-review-body">
							<div className="received-review-topline">
								<strong className="received-review-author">{[review.nombre_cliente, review.apellido_cliente].filter(Boolean).join(' ') || 'Cliente'}</strong>
								<time dateTime={review.fecha_creacion}>{formatDate(review.fecha_creacion)}</time>
							</div>
							<div className="received-review-heading">
								<div><Stars rating={review.calificacion} /><span className="received-review-score">{review.calificacion}.0 / 5</span></div>
							</div>
							{review.comentario
								? <p className="received-review-comment">{review.comentario}</p>
								: <p className="received-review-no-comment">El cliente dejó una calificación sin comentario.</p>}
						</div>
					</article>)}</div>
				</section>}
		</div>}
	</section>
}

export default ResenasRecibidas
