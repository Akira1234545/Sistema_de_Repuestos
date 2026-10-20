import { useCallback, useEffect, useMemo, useState } from 'react'
import { guardarCategoriaAdministracion, obtenerCategoriasAdministracion } from '../services/adminService.js'

const emptyForm = { id: '', nombre: '', descripcion: '', categoria_padre_id: '', activo: true }

function AdminCategories() {
	const [categories, setCategories] = useState([])
	const [form, setForm] = useState(emptyForm)
	const [search, setSearch] = useState('')
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')

	const loadCategories = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			setCategories(await obtenerCategoriasAdministracion())
		} catch (cause) {
			setError(`No se pudieron cargar las categorías: ${cause.message}`)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		const timer = window.setTimeout(() => { void loadCategories() }, 0)
		return () => window.clearTimeout(timer)
	}, [loadCategories])

	const visibleCategories = useMemo(() => {
		const term = search.trim().toLocaleLowerCase()
		if (!term) return categories
		return categories.filter((category) => [
			category.nombre, category.descripcion, category.categoria_padre_nombre, category.activo ? 'activa' : 'inactiva',
		].some((value) => String(value || '').toLocaleLowerCase().includes(term)))
	}, [categories, search])

	function editCategory(category) {
		setForm({
			id: category.id,
			nombre: category.nombre,
			descripcion: category.descripcion || '',
			categoria_padre_id: category.categoria_padre_id || '',
			activo: category.activo,
		})
		setError('')
		setNotice('')
		document.getElementById('admin-category-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
	}

	function updateField(event) {
		const { name, value, checked, type } = event.target
		setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
	}

	async function saveCategory(event) {
		event.preventDefault()
		setSaving(true)
		setError('')
		setNotice('')
		try {
			await guardarCategoriaAdministracion(form)
			setNotice(`La categoría “${form.nombre.trim()}” se guardó correctamente.`)
			setForm(emptyForm)
			await loadCategories()
		} catch (cause) {
			setError(`No se pudo guardar la categoría: ${cause.message}`)
		} finally {
			setSaving(false)
		}
	}

	async function toggleCategory(category) {
		setSaving(true)
		setError('')
		setNotice('')
		try {
			await guardarCategoriaAdministracion({ ...category, activo: !category.activo })
			setNotice(`La categoría “${category.nombre}” fue ${category.activo ? 'desactivada' : 'activada'}.`)
			await loadCategories()
		} catch (cause) {
			setError(`No se pudo cambiar el estado: ${cause.message}`)
		} finally {
			setSaving(false)
		}
	}

	return <section className="admin-panel" aria-labelledby="admin-categories-title">
		<div className="admin-section-heading">
			<div><p className="admin-kicker">CATÁLOGO DEL SISTEMA</p><h2 id="admin-categories-title">Categorías de repuestos</h2><p>Administra el árbol de categorías sin borrar registros relacionados.</p></div>
			<button type="button" className="button button-secondary" onClick={() => { void loadCategories() }} disabled={loading || saving}>Actualizar</button>
		</div>
		{error && <p className="admin-alert" role="alert">{error}</p>}
		{notice && <p className="admin-notice" role="status">{notice}</p>}
		<form id="admin-category-form" className="admin-category-form" onSubmit={saveCategory}>
			<h3>{form.id ? 'Editar categoría' : 'Crear categoría'}</h3>
			<div className="admin-category-fields">
				<label>Nombre<input name="nombre" value={form.nombre} onChange={updateField} maxLength="100" required /></label>
				<label>Categoría padre<select name="categoria_padre_id" value={form.categoria_padre_id} onChange={updateField}>
					<option value="">Sin categoría padre</option>
					{categories.filter((category) => category.activo && category.id !== form.id).map((category) => <option key={category.id} value={category.id}>{category.categoria_padre_nombre ? `${category.categoria_padre_nombre} / ` : ''}{category.nombre}</option>)}
				</select></label>
				<label className="admin-category-description">Descripción<textarea name="descripcion" value={form.descripcion} onChange={updateField} maxLength="5000" rows="3" /></label>
			</div>
			<label className="admin-maintenance-toggle"><input type="checkbox" name="activo" checked={form.activo} onChange={updateField} /> Categoría activa</label>
			<div className="admin-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Crear categoría'}</button>{form.id && <button className="button button-secondary" type="button" onClick={() => { setForm(emptyForm); setError(''); setNotice('') }} disabled={saving}>Cancelar edición</button>}</div>
		</form>
		<label className="admin-user-search">Buscar categoría<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, descripción, padre o estado" /></label>
		{loading ? <p role="status">Cargando categorías…</p> : visibleCategories.length === 0
			? <section className="admin-empty"><h3>No hay categorías para mostrar</h3><p>Crea una categoría o cambia la búsqueda.</p></section>
			: <div className="admin-category-list">{visibleCategories.map((category) => <article className="admin-category-card" key={category.id}>
				<div className="admin-category-card-heading"><div><span className={`admin-user-state${category.activo ? ' is-active' : ''}`}>{category.activo ? 'Activa' : 'Inactiva'}</span><h3>{category.nombre}</h3></div><small>{category.categoria_padre_nombre ? `Subcategoría de ${category.categoria_padre_nombre}` : 'Categoría principal'}</small></div>
				<p>{category.descripcion || 'Sin descripción.'}</p>
				<div className="admin-actions"><button type="button" className="button button-secondary" onClick={() => editCategory(category)} disabled={saving}>Editar</button><button type="button" className={`button ${category.activo ? 'button-danger' : 'button-primary'}`} onClick={() => { void toggleCategory(category) }} disabled={saving}>{category.activo ? 'Desactivar' : 'Activar'}</button></div>
			</article>)}</div>}
	</section>
}

export default AdminCategories
