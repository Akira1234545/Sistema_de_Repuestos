import { publicError } from '../lib/errors.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { guardarCategoriaAdministracion, obtenerCategoriasAdministracion } from '../services/adminService.js'
import Select from '../components/ui/Select.jsx'
import Icon from '../components/Icon.jsx'

const emptyForm = { id: '', nombre: '', descripcion: '', categoria_padre_id: '', activo: true }

function AdminCategories() {
	const [categories, setCategories] = useState([])
	const [form, setForm] = useState(emptyForm)
	const [search, setSearch] = useState('')
	const [formOpen, setFormOpen] = useState(false)
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
			setError(`No se pudieron cargar las categorías: ${publicError(cause)}`)
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

	// Without a search, main categories act as folders so 60+ entries stay scannable on a phone.
	const grouped = useMemo(() => {
		if (search.trim()) return null
		const parents = categories.filter((category) => !category.categoria_padre_id)
		return parents.map((parent) => ({ parent, children: categories.filter((category) => category.categoria_padre_id === parent.id) }))
	}, [categories, search])
	function renderCard(category) {
		return <article className="admin-category-card" key={category.id}>
			<div className="admin-category-card-heading"><div><span className={`admin-user-state${category.activo ? ' is-active' : ''}`}>{category.activo ? 'Activa' : 'Inactiva'}</span><h3>{category.nombre}</h3></div><small>{category.categoria_padre_nombre ? `Subcategoría de ${category.categoria_padre_nombre}` : 'Categoría principal'}</small></div>
			<p>{category.descripcion || 'Sin descripción.'}</p>
			<div className="admin-actions"><button type="button" className="icon-action" onClick={() => editCategory(category)} disabled={saving} aria-label={`Editar ${category.nombre}`} title="Editar"><Icon name="edit" size={18} /></button><button type="button" className={`icon-action${category.activo ? ' is-danger' : ''}`} onClick={() => { void toggleCategory(category) }} disabled={saving} aria-label={`${category.activo ? 'Desactivar' : 'Activar'} ${category.nombre}`} title={category.activo ? 'Desactivar' : 'Activar'}><Icon name="power" size={18} /></button></div>
			</article>
	}

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
			setError(`No se pudo guardar la categoría: ${publicError(cause)}`)
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
			setError(`No se pudo cambiar el estado: ${publicError(cause)}`)
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
		<details className="admin-filter-panel admin-category-create" open={formOpen || Boolean(form.id)} onToggle={(event) => setFormOpen(event.currentTarget.open)}>
		<summary><Icon name={form.id ? 'edit' : 'plus'} size={16} /> {form.id ? `Editando: ${form.nombre || 'categoría'}` : 'Nueva categoría'}</summary>
		<form id="admin-category-form" className="admin-category-form" onSubmit={saveCategory}>
			<div className="admin-category-fields">
				<label>Nombre<input name="nombre" value={form.nombre} onChange={updateField} maxLength="100" required /></label>
				<label>Categoría padre<Select ariaLabel="Categoría padre" name="categoria_padre_id" value={form.categoria_padre_id} onChange={updateField} options={[
					{ value: '', label: 'Sin categoría padre' },
					...categories.filter((category) => category.activo && category.id !== form.id).map((category) => ({ value: category.id, label: `${category.categoria_padre_nombre ? `${category.categoria_padre_nombre} / ` : ''}${category.nombre}` })),
				]} /></label>
				<label className="admin-category-description">Descripción<textarea name="descripcion" value={form.descripcion} onChange={updateField} maxLength="5000" rows="3" /></label>
			</div>
			<label className="admin-maintenance-toggle"><input type="checkbox" name="activo" checked={form.activo} onChange={updateField} /> Categoría activa</label>
			<div className="admin-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Crear categoría'}</button>{form.id && <button className="button button-secondary" type="button" onClick={() => { setForm(emptyForm); setError(''); setNotice('') }} disabled={saving}>Cancelar edición</button>}</div>
		</form>
		</details>
		<div className="list-toolbar"><label className="list-search"><Icon name="search" size={18} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar categoría" aria-label="Buscar por nombre, descripción, padre o estado" /></label></div>
		{loading ? <p role="status">Cargando categorías…</p> : visibleCategories.length === 0
			? <section className="admin-empty"><h3>No hay categorías para mostrar</h3><p>Crea una categoría o cambia la búsqueda.</p></section>
			: grouped
				? <div className="admin-category-groups">{grouped.map(({ parent, children }) => <details className="admin-category-group" key={parent.id}>
					<summary><span className="request-card-chevron" aria-hidden="true"><Icon name="chevron" size={16} /></span><strong>{parent.nombre}</strong><span className="admin-category-count">{children.length} {children.length === 1 ? 'subcategoría' : 'subcategorías'}</span>{!parent.activo && <span className="admin-user-state">Inactiva</span>}</summary>
					<div className="admin-category-list">{[parent, ...children].map((category) => renderCard(category))}</div>
				</details>)}</div>
				: <div className="admin-category-list">{visibleCategories.map((category) => renderCard(category))}</div>}
	</section>
}

export default AdminCategories
