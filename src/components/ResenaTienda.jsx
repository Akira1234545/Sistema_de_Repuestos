import { useEffect, useState } from 'react'
import { crearResena, obtenerResenaDePropuesta } from '../services/resenaService.js'
import './ResenaTienda.css'

function errorMessage(error) {
	if (error.code === '23505') return 'Ya existe una reseña para esta propuesta. Actualiza la página para verla.'
	if (error.code === '42501' || error.code === '28000') return 'No tienes permiso para reseñar esta propuesta.'
	return error.message || 'Ocurrió un error inesperado.'
}

function Stars({ score }) {
	return <span className="review-stars" aria-label={`${score} de 5 estrellas`}>
		{'★'.repeat(score)}{'☆'.repeat(5 - score)}
	</span>
}

function ResenaTienda({ usuarioId, tiendaId, propuestaId, tiendaNombre }) {
	const [review, setReview] = useState(null)
	const [rating, setRating] = useState(0)
	const [comment, setComment] = useState('')
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')
	const [reload, setReload] = useState(0)

	useEffect(() => {
		let active = true
		obtenerResenaDePropuesta(propuestaId)
			.then((data) => {
				if (active) {
					setReview(data)
					setRating(data?.calificacion || 0)
					setComment(data?.comentario || '')
					setError('')
				}
			})
			.catch((cause) => {
				if (active) setError(`No se pudo consultar la reseña: ${errorMessage(cause)}`)
			})
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [propuestaId, reload])

	async function submit(event) {
		event.preventDefault()
		if (rating < 1 || rating > 5) {
			setError('Selecciona una calificación de 1 a 5 estrellas.')
			return
		}
		setSaving(true)
		setError('')
		setSuccess('')
		try {
			const savedReview = await crearResena({ usuarioId, tiendaId, propuestaId, calificacion: rating, comentario: comment })
			setReview(savedReview)
			setSuccess('Tu reseña se guardó correctamente.')
		} catch (cause) {
			setError(`No se pudo guardar la reseña: ${errorMessage(cause)}`)
			if (cause.code === '23505') {
				setLoading(true)
				setReload((value) => value + 1)
			}
		} finally {
			setSaving(false)
		}
	}

	return <section className="store-review-form" aria-labelledby={`review-heading-${propuestaId}`}>
		<h3 id={`review-heading-${propuestaId}`}>Califica a {tiendaNombre}</h3>
		{loading && <p role="status">Consultando reseña...</p>}
		{error && <p className="store-review-error" role="alert">{error}</p>}
		{!loading && error.startsWith('No se pudo consultar') && <button className="store-review-retry" type="button" onClick={() => setReload((value) => value + 1)}>Reintentar</button>}
		{!loading && review && <div className="store-review-saved">
			<p>Tu reseña registrada: <Stars score={review.calificacion} /></p>
			{review.comentario && <p className="store-review-comment">{review.comentario}</p>}
		</div>}
		{!loading && !review && !error.startsWith('No se pudo consultar') && <form onSubmit={submit}>
			<fieldset className="store-review-rating" disabled={saving}>
				<legend>Calificación (obligatoria)</legend>
				<div>{[1, 2, 3, 4, 5].map((value) => <button
					aria-label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
					aria-pressed={rating === value}
					className={value <= rating ? 'selected' : ''}
					key={value}
					onClick={() => setRating(value)}
					type="button"
				>★</button>)}</div>
			</fieldset>
			<label className="store-review-comment-field">Comentario (opcional)
				<textarea maxLength={2000} onChange={(event) => setComment(event.target.value)} value={comment} rows="3" />
			</label>
			<button className="store-review-submit" type="submit" disabled={saving || rating === 0}>
				{saving ? 'Guardando…' : 'Enviar reseña'}
			</button>
		</form>}
		{success && <p className="store-review-success" role="status">{success}</p>}
	</section>
}

export default ResenaTienda
