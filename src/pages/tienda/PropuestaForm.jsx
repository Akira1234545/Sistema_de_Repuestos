import { useState } from 'react'
import { crearPropuesta } from '../../services/propuestaService.js'

const emptyProposal = { precio: '', marca: '', disponibilidad: '', caracteristicas: '', garantia: '', observaciones: '' }

function PropuestaForm({ solicitudId, onCreated }) {
	const [form, setForm] = useState(emptyProposal)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })) }
	async function submit(event) {
		event.preventDefault(); setError('')
		if (!form.marca.trim() || !form.disponibilidad.trim() || form.precio === '' || !Number.isFinite(Number(form.precio)) || Number(form.precio) < 0) {
			setError('Completa un precio válido, la marca y la disponibilidad.'); return
		}
		setSaving(true)
		try { await crearPropuesta({ ...form, precio: Number(form.precio), solicitud_id: solicitudId }); onCreated() }
		catch (saveError) { setError(saveError.message || 'No se pudo enviar la propuesta.') }
		finally { setSaving(false) }
	}
	return <form className="proposal-form" onSubmit={submit}>
		{error && <p className="proposal-error" role="alert">{error}</p>}
		<div className="proposal-form-grid">
			<label>Precio<input name="precio" type="number" min="0" step="0.01" value={form.precio} onChange={update} required /></label>
			<label>Marca<input name="marca" value={form.marca} onChange={update} maxLength="100" required /></label>
			<label className="proposal-field-wide">Disponibilidad<input name="disponibilidad" value={form.disponibilidad} onChange={update} placeholder="Ej. Disponible para entrega inmediata" maxLength="250" required /></label>
			<label>Garantía<input name="garantia" value={form.garantia} onChange={update} maxLength="250" /></label>
			<label className="proposal-field-wide">Características<textarea name="caracteristicas" value={form.caracteristicas} onChange={update} rows="3" /></label>
			<label className="proposal-field-wide">Observaciones<textarea name="observaciones" value={form.observaciones} onChange={update} rows="3" /></label>
		</div>
		<button className="button proposal-submit" type="submit" disabled={saving}>{saving ? 'Enviando…' : 'Enviar propuesta'}</button>
	</form>
}
export default PropuestaForm
