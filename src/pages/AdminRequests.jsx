import { useCallback, useEffect, useState } from 'react'
import { obtenerCategoriasAdministracion, obtenerSolicitudesAdministracion } from '../services/adminService.js'

const requestStatuses = ['publicada', 'recibiendo_propuestas', 'propuesta_seleccionada', 'atendida', 'cerrada']
const pageSize = 25

function formatDate(value) {
	return value ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Sin fecha'
}

function AdminRequests() {
	const [categories, setCategories] = useState([])
	const [requests, setRequests] = useState([])
	const [filter, setFilter] = useState({ estado: '', categoriaId: '', fechaDesde: '', fechaHasta: '', buscar: '' })
	const [page, setPage] = useState(0)
	const [totalCount, setTotalCount] = useState(0)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	const loadCategories = useCallback(async () => {
		try {
			setCategories(await obtenerCategoriasAdministracion())
		} catch (cause) {
			setError(`No se pudieron cargar las categorías para filtrar: ${cause.message}`)
		}
	}, [])

	const loadRequests = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			const data = await obtenerSolicitudesAdministracion({ ...filter, limit: pageSize, offset: page * pageSize })
			setRequests(data)
			setTotalCount(Number(data[0]?.total_count || 0))
		} catch (cause) {
			setRequests([])
			setTotalCount(0)
			setError(`No se pudieron cargar las solicitudes: ${cause.message}`)
		} finally {
			setLoading(false)
		}
	}, [filter, page])

	useEffect(() => {
		const timer = window.setTimeout(() => { void loadCategories() }, 0)
		return () => window.clearTimeout(timer)
	}, [loadCategories])

	useEffect(() => {
		const timer = window.setTimeout(() => { void loadRequests() }, 0)
		return () => window.clearTimeout(timer)
	}, [loadRequests])

	function updateFilter(event) {
		const { name, value } = event.target
		setPage(0)
		setFilter((current) => ({ ...current, [name]: value }))
	}

	const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))

	return <section className="admin-panel" aria-labelledby="admin-requests-title">
		<div className="admin-section-heading">
			<div><p className="admin-kicker">SUPERVISIÓN DE LA PLATAFORMA</p><h2 id="admin-requests-title">Solicitudes publicadas</h2><p>Consulta las solicitudes y sus datos asociados. Esta pantalla es solo de lectura.</p></div>
			<button type="button" className="button button-secondary" onClick={() => { void loadRequests() }} disabled={loading}>Actualizar</button>
		</div>
		{error && <p className="admin-alert" role="alert">{error}</p>}
		<div className="admin-request-filters">
			<label>Estado<select name="estado" value={filter.estado} onChange={updateFilter}><option value="">Todos los estados</option>{requestStatuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
			<label>Categoría<select name="categoriaId" value={filter.categoriaId} onChange={updateFilter}><option value="">Todas las categorías</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}</select></label>
			<label>Desde<input type="date" name="fechaDesde" value={filter.fechaDesde} onChange={updateFilter} /></label>
			<label>Hasta<input type="date" name="fechaHasta" value={filter.fechaHasta} onChange={updateFilter} /></label>
			<label className="admin-request-search">Buscar por título<input name="buscar" value={filter.buscar} onChange={updateFilter} placeholder="Título de la solicitud" /></label>
		</div>
		{loading ? <p role="status">Cargando solicitudes…</p> : requests.length === 0
			? <section className="admin-empty"><h3>No hay solicitudes para mostrar</h3><p>Prueba otros filtros o fechas.</p></section>
			: <>
				<p className="admin-request-count">Solicitudes encontradas: {totalCount}</p>
				<div className="admin-request-list">{requests.map((request) => <details className="admin-request-card" key={request.id}>
					<summary>
						<div className="admin-request-summary"><div><span className={`admin-status admin-request-status-${request.estado}`}>{request.estado.replaceAll('_', ' ')}</span><h3>{request.titulo}</h3><p>{request.categoria_nombre || 'Categoría no disponible'} · {request.cliente_nombre || 'Cliente no disponible'}</p></div><time dateTime={request.fecha_creacion}>{formatDate(request.fecha_creacion)}</time></div>
					</summary>
					<div className="admin-request-detail">
						<dl>
							<div><dt>Descripción</dt><dd>{request.descripcion}</dd></div>
							{request.caracteristicas && <div><dt>Características solicitadas</dt><dd>{request.caracteristicas}</dd></div>}
							<div><dt>Cantidad</dt><dd>{request.cantidad}</dd></div>
							<div><dt>Cliente</dt><dd>{request.cliente_nombre || 'No disponible'}{request.cliente_correo ? ` · ${request.cliente_correo}` : ''}</dd></div>
							<div><dt>Vehículo</dt><dd>{[request.vehiculo_tipo, request.vehiculo_marca, request.vehiculo_modelo].filter(Boolean).join(' · ') || 'No disponible'}{request.vehiculo_anio ? ` · ${request.vehiculo_anio}` : ''}</dd></div>
							{request.vehiculo_descripcion && <div><dt>Detalle del vehículo</dt><dd>{request.vehiculo_descripcion}</dd></div>}
							<div><dt>Creada</dt><dd>{formatDate(request.fecha_creacion)}</dd></div>
							<div><dt>Última actualización</dt><dd>{formatDate(request.fecha_actualizacion)}</dd></div>
							<div><dt>ID de solicitud</dt><dd>{request.id}</dd></div>
							{request.propuesta_seleccionada_id && <div><dt>Propuesta seleccionada</dt><dd>{request.propuesta_seleccionada_id}</dd></div>}
						</dl>
						{request.fotografias?.length > 0 && <div className="admin-request-photos"><strong>Fotografías</strong><div>{request.fotografias.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer">Abrir imagen ↗</a>)}</div></div>}
					</div>
				</details>)}</div>
				<nav className="admin-pagination" aria-label="Paginación de solicitudes">
					<button type="button" className="button button-secondary" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || loading}>Anterior</button>
					<span>Página {page + 1} de {pageCount}</span>
					<button type="button" className="button button-secondary" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page + 1 >= pageCount || loading}>Siguiente</button>
				</nav>
			</>}
	</section>
}

export default AdminRequests
