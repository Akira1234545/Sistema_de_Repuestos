import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import { guardarCategoriasTienda, obtenerCategoriasGestionTienda } from '../../services/tiendaService.js'
import './CategoriasTienda.css'

function CategoriasTienda() {
	const { user } = useAuth()
	const [store, setStore] = useState(null)
	const [categories, setCategories] = useState([])
	const [selectedIds, setSelectedIds] = useState([])
	const [initialIds, setInitialIds] = useState([])
	const [unavailableCount, setUnavailableCount] = useState(0)
	const [search, setSearch] = useState('')
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')

	useEffect(() => {
		let active = true
		obtenerCategoriasGestionTienda(user.id)
			.then((result) => {
				if (!active) return
				setStore(result.store)
				setCategories(result.categories)
				setSelectedIds(result.selectedIds)
				setInitialIds(result.selectedIds)
				setUnavailableCount(result.unavailableCount)
			})
			.catch((loadError) => { if (active) setError(`No se pudieron cargar las categorías. Comprueba que la migración de categorías esté aplicada y que tu tienda tenga acceso. ${loadError.message}`) })
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [user.id])

	const visibleCategories = useMemo(() => {
		const term = search.trim().toLocaleLowerCase()
		return categories.filter((category) => !term || `${category.nombre} ${category.descripcion || ''}`.toLocaleLowerCase().includes(term))
	}, [categories, search])
	const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
	const hasChanges = selectedIds.length !== initialIds.length || selectedIds.some((id) => !initialIds.includes(id))

	function toggleCategory(id) {
		setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
		setNotice('')
	}

	function toggleVisible() {
		const allSelected = visibleCategories.length > 0 && visibleCategories.every((category) => selectedSet.has(category.id))
		setSelectedIds((current) => {
			const next = new Set(current)
			for (const category of visibleCategories) {
				if (allSelected) next.delete(category.id)
				else next.add(category.id)
			}
			return [...next]
		})
		setNotice('')
	}

	async function saveCategories(event) {
		event.preventDefault()
		setSaving(true); setError(''); setNotice('')
		try {
			await guardarCategoriasTienda(selectedIds)
			setInitialIds(selectedIds)
			setUnavailableCount(0)
			setNotice('Tus categorías de atención se guardaron correctamente. Ya se usan para filtrar solicitudes y validar propuestas.')
		} catch (saveError) {
			setError(`No se pudieron guardar las categorías: ${saveError.message}`)
		} finally { setSaving(false) }
	}

	if (loading) return <section className="store-page"><p className="store-message">Cargando categorías…</p></section>
	if (!store && error) return <section className="store-page"><div className="categories-empty"><p className="store-eyebrow">Categorías de tienda</p><h1>No se pudo cargar la configuración</h1><p className="categories-error" role="alert">{error}</p><Link className="button" to="/tienda/editar">Revisar perfil de tienda</Link></div></section>
	if (!store) return <section className="store-page"><div className="categories-empty"><p className="store-eyebrow">Perfil de tienda</p><h1>Registra tu tienda primero</h1><p>Necesitas crear el perfil de tu tienda antes de elegir qué categorías atiendes.</p><Link className="button" to="/tienda/editar">Crear perfil de tienda</Link></div></section>

	return <section className="store-page store-categories-page">
		<header className="categories-heading">
			<div><p className="store-eyebrow">Configuración de tienda / Categorías</p><h1>Categorías que atiende tu tienda</h1><p className="store-lead">Elige las familias de repuestos que ofreces. Esta selección determina qué solicitudes puedes consultar y para cuáles puedes enviar propuestas.</p></div>
			<div className={`categories-store-status${store.estado === 'aprobada' && store.activa ? ' is-approved' : ''}`}><span>{store.estado === 'aprobada' && store.activa ? 'Tienda aprobada' : `Estado: ${store.estado}`}</span><strong>{store.nombre}</strong></div>
		</header>

		{store.estado !== 'aprobada' || !store.activa ? <p className="categories-pending" role="status">Puedes preparar tus categorías ahora. Las solicitudes y propuestas estarán disponibles cuando la tienda esté aprobada y activa.</p> : null}
		{error && <p className="categories-error" role="alert">{error}</p>}
		{notice && <p className="categories-success" role="status">{notice}</p>}
		{unavailableCount > 0 && <p className="categories-pending" role="status">Hay {unavailableCount} categoría(s) asignada(s) que ya no están activas. Al guardar, se quitarán y podrás elegir entre las categorías activas.</p>}

		<form className="categories-manager" onSubmit={saveCategories}>
			<div className="categories-toolbar"><label className="categories-search">Buscar categoría<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ej. frenos, motor, suspensión…" /></label><div className="categories-selection"><strong>{selectedIds.length}</strong><span>{selectedIds.length === 1 ? 'categoría seleccionada' : 'categorías seleccionadas'}</span></div></div>
			<div className="categories-list-heading"><div><h2>Catálogo activo</h2><p>Solo aparecen categorías activas del catálogo del sistema.</p></div><button className="categories-select-visible" type="button" onClick={toggleVisible} disabled={!visibleCategories.length}>{visibleCategories.length && visibleCategories.every((category) => selectedSet.has(category.id)) ? 'Quitar visibles' : 'Seleccionar visibles'}</button></div>
			{categories.length === 0 ? <div className="categories-empty"><h2>No hay categorías activas</h2><p>El administrador debe revisar el catálogo `categorias_repuesto` en Supabase. No se agregaron categorías ficticias.</p></div> : visibleCategories.length === 0 ? <div className="categories-empty"><h2>No hay coincidencias</h2><p>Prueba con otro término de búsqueda.</p></div> : <div className="categories-grid">{visibleCategories.map((category) => <label className={`category-choice${selectedSet.has(category.id) ? ' is-selected' : ''}`} key={category.id}>
				<input type="checkbox" checked={selectedSet.has(category.id)} onChange={() => toggleCategory(category.id)} />
				<span className="category-choice-check" aria-hidden="true">{selectedSet.has(category.id) ? '✓' : '+'}</span>
				<span className="category-choice-copy"><strong>{category.nombre}</strong>{category.descripcion && <small>{category.descripcion}</small>}</span>
			</label>)}</div>}
			<footer className="categories-footer"><p>El cambio se aplica al guardar. Puedes volver aquí para editar tu selección más adelante.</p><button className="button" type="submit" disabled={saving || !hasChanges || categories.length === 0}>{saving ? 'Guardando…' : 'Guardar categorías'}</button></footer>
		</form>
	</section>
}

export default CategoriasTienda
