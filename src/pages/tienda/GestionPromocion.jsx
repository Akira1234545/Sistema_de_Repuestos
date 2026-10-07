import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import { obtenerCategoriasActivas } from '../../services/solicitudService.js'
import { obtenerTiendaUsuario } from '../../services/tiendaService.js'
import { actualizarPromocion, crearPromocion, obtenerPromocion } from '../../services/promocionService.js'
import '../Promociones.css'

const blank = { categoria_id: '', titulo: '', descripcion: '', marca: '', precio_anterior: '', precio_oferta: '', caracteristicas: '', fecha_inicio: '', fecha_fin: '' }
function localDateInput(value) {
	if (!value) return ''
	const date = new Date(value); const offset = date.getTimezoneOffset() * 60000
	return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
function GestionPromocion() {
	const { id } = useParams()
	const { user } = useAuth()
	const navigate = useNavigate()
	const [form, setForm] = useState(blank)
	const [categories, setCategories] = useState([])
	const [store, setStore] = useState(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	const canManagePromotions = store?.estado === 'aprobada' && store.activa
	useEffect(() => {
		let active = true
		Promise.all([obtenerCategoriasActivas(), obtenerTiendaUsuario(user.id), id ? obtenerPromocion(id) : Promise.resolve(null)])
			.then(([cats, ownStore, item]) => {
				if (!active) return
				setCategories(cats); setStore(ownStore)
				if (!ownStore) setError('Primero completa el perfil de tu tienda.')
				else if (id && !item) setError('No se encontró esta promoción en tu tienda.')
				else if (item) setForm({ categoria_id: item.categoria_id, titulo: item.titulo, descripcion: item.descripcion || '', marca: item.marca || '', precio_anterior: String(item.precio_anterior), precio_oferta: String(item.precio_oferta), caracteristicas: item.caracteristicas || '', fecha_inicio: localDateInput(item.fecha_inicio), fecha_fin: localDateInput(item.fecha_fin) })
			}).catch((cause) => { if (active) setError(`No se pudieron cargar los datos: ${cause.message}`) }).finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [user.id, id])
	function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })) }
	async function submit(event) {
		event.preventDefault(); setError('')
		if (!form.titulo.trim() || !form.categoria_id) { setError('Completa el título y la categoría.'); return }
		if (!Number.isFinite(Number(form.precio_anterior)) || !Number.isFinite(Number(form.precio_oferta)) || Number(form.precio_anterior) < 0 || Number(form.precio_oferta) < 0 || Number(form.precio_oferta) > Number(form.precio_anterior)) { setError('El precio de oferta debe ser válido y no superar el precio anterior.'); return }
		if (!form.fecha_inicio || !form.fecha_fin || new Date(form.fecha_fin) <= new Date(form.fecha_inicio)) { setError('La fecha final debe ser posterior a la fecha inicial.'); return }
		setSaving(true)
		try {
			if (id) await actualizarPromocion(id, form)
			else await crearPromocion(store.id, form)
			navigate('/tienda/promociones')
		} catch (cause) { setError(`No se pudo guardar la promoción: ${cause.message}`) }
		finally { setSaving(false) }
	}
	if (loading) return <main className="promo-page"><p className="promo-state">Cargando…</p></main>
	return <main className="promo-page promo-form-page"><header className="promo-page-heading"><div><p className="promo-eyebrow">Panel de tienda / HU-11</p><h1>{id ? 'Editar promoción' : 'Crear promoción'}</h1><p>El descuento porcentual se calcula automáticamente a partir de ambos precios.</p></div><Link to="/tienda/promociones">Volver</Link></header>
		{error && <p className="promo-error" role="alert">{error}</p>}
		{store && !canManagePromotions && <p className="promo-state" role="status">La gestión de promociones requiere una tienda activa y aprobada. Estado actual: {store.estado}{store.activa ? '' : ' (inactiva)'}.</p>}
		{store && canManagePromotions && <form className="promo-form" onSubmit={submit}><div className="promo-form-grid">
			<label>Título<input name="titulo" value={form.titulo} onChange={update} maxLength="160" required /></label>
			<label>Categoría<select name="categoria_id" value={form.categoria_id} onChange={update} required><option value="">Selecciona una categoría</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
			<label>Marca<input name="marca" value={form.marca} onChange={update} maxLength="100" /></label>
			<label>Precio anterior<input name="precio_anterior" type="number" min="0" step="0.01" value={form.precio_anterior} onChange={update} required /></label>
			<label>Precio de oferta<input name="precio_oferta" type="number" min="0" step="0.01" value={form.precio_oferta} onChange={update} required /></label>
			<label>Fecha y hora de inicio<input name="fecha_inicio" type="datetime-local" value={form.fecha_inicio} onChange={update} required /></label>
			<label>Fecha y hora de fin<input name="fecha_fin" type="datetime-local" value={form.fecha_fin} onChange={update} required /></label>
			<label className="promo-field-wide">Descripción<textarea name="descripcion" value={form.descripcion} onChange={update} rows="3" /></label>
			<label className="promo-field-wide">Características<textarea name="caracteristicas" value={form.caracteristicas} onChange={update} rows="3" /></label>
		</div><div className="promo-form-actions"><Link to="/tienda/promociones">Cancelar</Link><button className="button promo-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar promoción'}</button></div></form>}
	</main>
}
export default GestionPromocion
