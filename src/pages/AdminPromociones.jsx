import { useCallback, useEffect, useState } from 'react'
import { obtenerCategoriasAdministracion, obtenerPromocionesAdministracion, obtenerTiendasConPromocionesAdministracion } from '../services/adminService.js'
import './AdminPromociones.css'

const pageSize = 25
const promotionStatuses = ['activa', 'pausada', 'finalizada']
const currency = new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' })
const dateFormatter = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' })

function formatDate(value) {
	if (!value) return 'Sin fecha'
	const date = new Date(value)
	return Number.isNaN(date.getTime()) ? 'Fecha no válida' : dateFormatter.format(date)
}

function AdminPromociones() {
	const [promotions, setPromotions] = useState([])
	const [categories, setCategories] = useState([])
	const [stores, setStores] = useState([])
	const [filters, setFilters] = useState({ tiendaId: '', categoriaId: '', estado: '', fechaDesde: '', fechaHasta: '' })
	const [search, setSearch] = useState('')
	const [debouncedSearch, setDebouncedSearch] = useState('')
	const [page, setPage] = useState(0)
	const [totalCount, setTotalCount] = useState(0)
	const [loading, setLoading] = useState(true)
	const [optionsLoading, setOptionsLoading] = useState(true)
	const [error, setError] = useState('')
	const [optionsError, setOptionsError] = useState('')

	const loadOptions = useCallback(async () => {
		setOptionsLoading(true)
		setOptionsError('')
		try {
			const [categoryRows, storeRows] = await Promise.all([
				obtenerCategoriasAdministracion(),
				obtenerTiendasConPromocionesAdministracion(),
			])
			setCategories(categoryRows)
			setStores(storeRows)
		} catch (cause) {
			setOptionsError(`No se pudieron cargar las opciones de filtro: ${cause.message}`)
		} finally {
			setOptionsLoading(false)
		}
	}, [])

	const loadPromotions = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			const data = await obtenerPromocionesAdministracion({
				...filters,
				buscar: debouncedSearch,
				limit: pageSize,
				offset: page * pageSize,
			})
			setPromotions(data)
			setTotalCount(Number(data[0]?.total_count || 0))
		} catch (cause) {
			setPromotions([])
			setTotalCount(0)
			setError(`No se pudieron cargar las promociones: ${cause.message}`)
		} finally {
			setLoading(false)
		}
	}, [filters, debouncedSearch, page])

	useEffect(() => {
		const timer = window.setTimeout(() => { void loadOptions() }, 0)
		return () => window.clearTimeout(timer)
	}, [loadOptions])

	useEffect(() => {
		const timer = window.setTimeout(() => setDebouncedSearch(search), 250)
		return () => window.clearTimeout(timer)
	}, [search])

	useEffect(() => {
		const timer = window.setTimeout(() => { void loadPromotions() }, 0)
		return () => window.clearTimeout(timer)
	}, [loadPromotions])

	function updateFilter(event) {
		const { name, value } = event.target
		setPage(0)
		if (name === 'buscar') {
			setSearch(value)
			return
		}
		setFilters((current) => ({ ...current, [name]: value }))
	}

	const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))

	return <section className="admin-panel" aria-labelledby="admin-promotions-title">
		<div className="admin-section-heading">
			<div><p className="admin-kicker">SUPERVISIÓN DE LA PLATAFORMA</p><h2 id="admin-promotions-title">Promociones publicadas</h2><p>Consulta las promociones de todas las tiendas. Esta pantalla es de solo lectura.</p></div>
			<button type="button" className="button button-secondary" onClick={() => { void loadPromotions(); void loadOptions() }} disabled={loading || optionsLoading}>Actualizar</button>
		</div>
		{optionsError && <p className="admin-alert" role="alert">{optionsError}</p>}
		{error && <p className="admin-alert" role="alert">{error}</p>}
		<div className="admin-promotion-filters">
			<label>Tienda<select name="tiendaId" value={filters.tiendaId} onChange={updateFilter} disabled={optionsLoading}><option value="">Todas las tiendas</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.nombre}</option>)}</select></label>
			<label>Categoría<select name="categoriaId" value={filters.categoriaId} onChange={updateFilter} disabled={optionsLoading}><option value="">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}</select></label>
			<label>Estado<select name="estado" value={filters.estado} onChange={updateFilter}><option value="">Todos los estados</option>{promotionStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
			<label>Inicio desde<input name="fechaDesde" type="date" value={filters.fechaDesde} onChange={updateFilter} /></label>
			<label>Inicio hasta<input name="fechaHasta" type="date" value={filters.fechaHasta} onChange={updateFilter} /></label>
			<label className="admin-promotion-search">Buscar por título<input name="buscar" value={search} onChange={updateFilter} placeholder="Título de la promoción" /></label>
		</div>
		{loading ? <p role="status">Cargando promociones…</p> : promotions.length === 0
			? <section className="admin-empty"><h3>No hay promociones para mostrar</h3><p>Prueba con otros filtros o fechas.</p></section>
			: <>
				<p className="admin-request-count">Promociones encontradas: {totalCount}</p>
				<div className="admin-promotion-list">{promotions.map((promotion) => <details className="admin-promotion-card" key={promotion.id}>
					<summary>
						<div className="admin-promotion-summary">
							<div><span className={`admin-user-state admin-promotion-state-${promotion.estado}`}>{promotion.estado}</span><h3>{promotion.titulo}</h3><p>{promotion.tienda_nombre} · {promotion.categoria_nombre}{promotion.marca ? ` · ${promotion.marca}` : ''}</p></div>
							<div className="admin-promotion-price"><del>{currency.format(Number(promotion.precio_anterior))}</del><strong>{currency.format(Number(promotion.precio_oferta))}</strong><span>{Number(promotion.porcentaje_descuento || 0).toFixed(0)}% de descuento</span></div>
						</div>
						<div className="admin-promotion-dates"><span>Inicio: {formatDate(promotion.fecha_inicio)}</span><span>Fin: {formatDate(promotion.fecha_fin)}</span></div>
					</summary>
					<div className="admin-promotion-detail">
						<dl>
							<div><dt>Tienda</dt><dd>{promotion.tienda_nombre}</dd></div>
							<div><dt>Categoría</dt><dd>{promotion.categoria_nombre}</dd></div>
							<div><dt>Marca</dt><dd>{promotion.marca || 'No especificada'}</dd></div>
							<div><dt>Estado</dt><dd>{promotion.estado}</dd></div>
							<div><dt>Precio anterior</dt><dd>{currency.format(Number(promotion.precio_anterior))}</dd></div>
							<div><dt>Precio de oferta</dt><dd>{currency.format(Number(promotion.precio_oferta))}</dd></div>
							<div><dt>Descuento</dt><dd>{Number(promotion.porcentaje_descuento || 0).toFixed(2)}%</dd></div>
							<div><dt>Fecha de inicio</dt><dd>{formatDate(promotion.fecha_inicio)}</dd></div>
							<div><dt>Fecha de finalización</dt><dd>{formatDate(promotion.fecha_fin)}</dd></div>
							<div><dt>Creada</dt><dd>{formatDate(promotion.fecha_creacion)}</dd></div>
							<div><dt>Actualizada</dt><dd>{formatDate(promotion.fecha_actualizacion)}</dd></div>
							<div><dt>ID de promoción</dt><dd>{promotion.id}</dd></div>
							<div className="admin-promotion-description"><dt>Descripción</dt><dd>{promotion.descripcion || 'Sin descripción.'}</dd></div>
							{promotion.caracteristicas && <div className="admin-promotion-description"><dt>Características</dt><dd>{promotion.caracteristicas}</dd></div>}
						</dl>
						{promotion.fotografias?.length > 0 && <div className="admin-promotion-photos"><strong>Fotografías</strong><div>{promotion.fotografias.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">Abrir imagen ↗</a>)}</div></div>}
					</div>
				</details>)}</div>
				<nav className="admin-pagination" aria-label="Paginación de promociones">
					<button type="button" className="button button-secondary" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || loading}>Anterior</button>
					<span>Página {page + 1} de {pageCount}</span>
					<button type="button" className="button button-secondary" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page + 1 >= pageCount || loading}>Siguiente</button>
				</nav>
			</>}
	</section>
}

export default AdminPromociones
