import { useState } from 'react'
import { obtenerResenasPublicasTienda } from '../services/resenaService.js'

export default function PublicReviews({ storeId, storeName, initial, summary, error }) {
  const [reviews, setReviews] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  async function loadMore() {
    setBusy(true); setLoadError('')
    try {
      const data = await obtenerResenasPublicasTienda(storeId, reviews.length)
      setReviews(current => [...current, ...data.filter(item => !current.some(old => old.id === item.id))])
    } catch { setLoadError('No se pudieron cargar más reseñas. Inténtalo de nuevo.') }
    finally { setBusy(false) }
  }
  return <section className="public-store-reviews" aria-label={`Reseñas de ${storeName}`}>
    <h3>Calificaciones y reseñas</h3>
    <p className="public-store-rating">{error ? 'Reseñas no disponibles' : <>{summary?.promedio != null && <span>★ {Number(summary.promedio).toFixed(1)} / 5 · </span>}{summary?.total || '0'} reseñas</>}</p>
    {!error && !reviews.length && <p>Aún no hay reseñas.</p>}
    {reviews.map(review => <article className="public-store-review" key={review.id}>
      <p className="public-store-review-stars" aria-label={`${review.calificacion} de 5 estrellas`}>{'★'.repeat(review.calificacion)}{'☆'.repeat(5 - review.calificacion)}</p>
      {review.comentario && <p className="public-store-review-comment">{review.comentario}</p>}
      <time dateTime={review.fecha_creacion}>{new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeZone: 'America/La_Paz' }).format(new Date(review.fecha_creacion))}</time>
    </article>)}
    {loadError && <p role="alert">{loadError}</p>}
    {BigInt(summary?.total || '0') > BigInt(reviews.length) && <button className="button button-secondary" type="button" disabled={busy} onClick={loadMore}>{busy ? 'Cargando…' : 'Ver más reseñas'}</button>}
  </section>
}
