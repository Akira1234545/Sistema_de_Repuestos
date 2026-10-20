
import { useCallback, useEffect, useState } from 'react'
import { obtenerReportesActividadAdministracion } from '../services/adminService.js'
import './AdminReportes.css'

const timeZone = 'America/La_Paz'
const dateFormatter = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeZone })
const dateTimeFormatter = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short', timeZone })

const roleLabels = {
	superAdministrador: 'Superadministradores',
	administrador: 'Administradores',
	cliente: 'Clientes',
	tienda: 'Cuentas de tienda',
}

const storeStatusLabels = {
	pendiente: 'Pendientes',
	aprobada: 'Aprobadas',
	rechazada: 'Rechazadas',
	suspendida: 'Suspendidas',
}

const requestStatusLabels = {
	publicada: 'Publicadas',
	recibiendo_propuestas: 'Recibiendo propuestas',
	propuesta_seleccionada: 'Propuesta seleccionada',
	atendida: 'Atendidas',
	cerrada: 'Cerradas',
}

const proposalStatusLabels = {
	enviada: 'Enviadas',
	aceptada: 'Aceptadas',
	rechazada: 'Rechazadas',
	retirada: 'Retiradas',
}

const promotionStatusLabels = {
	activa: 'Activas',
	pausada: 'Pausadas',
	finalizada: 'Finalizadas',
}

const statusGroups = [
	{ key: 'roles', title: 'Usuarios por rol', labels: roleLabels },
	{ key: 'tiendas', title: 'Tiendas por estado', labels: storeStatusLabels },
	{ key: 'solicitudes', title: 'Solicitudes por estado', labels: requestStatusLabels },
	{ key: 'propuestas', title: 'Propuestas por estado', labels: proposalStatusLabels },
	{ key: 'promociones', title: 'Promociones por estado', labels: promotionStatusLabels },
]

function todayInAppTimeZone() {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(new Date())

	const values = Object.fromEntries(
		parts
			.filter((part) => part.type !== 'literal')
			.map(({ type, value }) => [type, value]),
	)

	return `${values.year}-${values.month}-${values.day}`
}

function initialPeriod() {
	const today = todayInAppTimeZone()
	return { fechaDesde: `${today.slice(0, 8)}01`, fechaHasta: today }
}

function formatCount(value) {
	return BigInt(value || '0').toLocaleString('es-BO')
}

function csvCell(value) {
	let text = String(value ?? '')
	let firstMeaningfulCharacter = 0

	while (firstMeaningfulCharacter < text.length) {
		const code = text.charCodeAt(firstMeaningfulCharacter)
		if (code > 0x20 && code !== 0x7f) break
		firstMeaningfulCharacter += 1
	}

	const firstCharacter = text[firstMeaningfulCharacter]
	if (firstCharacter && '=+-@'.includes(firstCharacter)) text = `'${text}`

	return `"${text.replaceAll('"', '""')}"`
}

function downloadCsv(report, period) {
	const generatedAt = new Date(report.generado_en)
	const generatedLabel = Number.isNaN(generatedAt.getTime())
		? report.generado_en
		: dateTimeFormatter.format(generatedAt)

	const categories = report.categorias ?? {}
	const categoryRequests = categories.solicitudes_por_categoria ?? []

	const rows = [
		['Reporte de actividad', 'Sistema de Repuestos'],
		['Periodo', `${period.fechaDesde} a ${period.fechaHasta}`],
		['Zona horaria', timeZone],
		['Agrupación temporal', report.periodo.agrupacion],
		['Generado', generatedLabel],
		[],
		['Indicadores', 'Total acumulado actual', 'Creados en el periodo'],
		['Usuarios', report.totales.usuarios, report.creados_periodo.usuarios],
		['Tiendas', report.totales.tiendas, report.creados_periodo.tiendas],
		['Tiendas activas y aprobadas', report.totales.tiendas_activas, ''],
		['Solicitudes', report.totales.solicitudes, report.creados_periodo.solicitudes],
		['Propuestas', report.totales.propuestas, report.creados_periodo.propuestas],
		['Promociones', report.totales.promociones, report.creados_periodo.promociones],
		['Categorías de repuestos', categories.total ?? 0, categories.creadas_periodo ?? 0],
		[],
		['Indicadores de categorías'],
		['Métrica', 'Cantidad'],
		['Categorías activas', categories.activas ?? 0],
		['Categorías inactivas', categories.inactivas ?? 0],
		['Categorías principales', categories.principales ?? 0],
		['Subcategorías', categories.subcategorias ?? 0],
		[],
		['Solicitudes por categoría'],
		['Categoría', 'Estado', 'Cantidad de solicitudes'],
		...categoryRequests.map((item) => [
			item.nombre,
			item.activa ? 'Activa' : 'Inactiva',
			item.solicitudes ?? 0,
		]),
		[],
		['Distribución actual por estado o rol'],
		['Grupo', 'Estado o rol', 'Cantidad'],
		...statusGroups.flatMap(({ key, labels }) =>
			Object.entries(labels).map(([status, label]) => [
				key === 'roles'
					? 'Usuarios'
					: key === 'tiendas'
						? 'Tiendas'
						: key[0].toUpperCase() + key.slice(1),
				label,
				report.distribucion[key][status],
			]),
		),
		[],
		[
			'Registros creados por intervalo',
			'Usuarios',
			'Tiendas',
			'Solicitudes',
			'Propuestas',
			'Promociones',
		],
		...report.serie_temporal.map((item) => [
			item.periodo,
			item.usuarios,
			item.tiendas,
			item.solicitudes,
			item.propuestas,
			item.promociones,
		]),
	]

	const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement('a')

	anchor.href = url
	anchor.download = `reporte_actividad_${period.fechaDesde}_${period.fechaHasta}.csv`

	document.body.append(anchor)
	anchor.click()
	anchor.remove()

	window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function AdminReportes() {
	const [period, setPeriod] = useState(initialPeriod)
	const [report, setReport] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')

	const loadReport = useCallback(async () => {
		if (!period.fechaDesde || !period.fechaHasta) {
			setError('Selecciona una fecha inicial y una fecha final.')
			setReport(null)
			setLoading(false)
			return
		}

		if (period.fechaDesde > period.fechaHasta) {
			setError('La fecha inicial no puede ser posterior a la fecha final.')
			setReport(null)
			setLoading(false)
			return
		}

		setLoading(true)
		setError('')
		setNotice('')

		try {
			setReport(
				await obtenerReportesActividadAdministracion(
					period.fechaDesde,
					period.fechaHasta,
				),
			)
		} catch (cause) {
			setReport(null)
			setError(`No se pudieron cargar los reportes de actividad: ${cause.message}`)
		} finally {
			setLoading(false)
		}
	}, [period])

	useEffect(() => {
		const timer = window.setTimeout(() => {
			void loadReport()
		}, 0)

		return () => window.clearTimeout(timer)
	}, [loadReport])

	function updatePeriod(event) {
		const { name, value } = event.target
		setPeriod((current) => ({ ...current, [name]: value }))
	}

	function exportReport() {
		setNotice('')

		if (!report) return

		const hasGeneralRecords = Object.values(report.totales ?? {}).some(
			(value) => BigInt(value || '0') > 0n,
		)

		const categories = report.categorias ?? {}
		const hasCategories = BigInt(categories.total || '0') > 0n

		if (!hasGeneralRecords && !hasCategories) {
			setNotice('No hay registros para exportar en la plataforma.')
			return
		}

		downloadCsv(report, period)
	}

	const totalCards = report
		? [
				{
					label: 'Usuarios registrados',
					total: report.totales.usuarios,
					period: report.creados_periodo.usuarios,
				},
				{
					label: 'Tiendas registradas',
					total: report.totales.tiendas,
					period: report.creados_periodo.tiendas,
					detail: `${formatCount(report.totales.tiendas_activas)} activas y aprobadas`,
				},
				{
					label: 'Solicitudes',
					total: report.totales.solicitudes,
					period: report.creados_periodo.solicitudes,
				},
				{
					label: 'Propuestas',
					total: report.totales.propuestas,
					period: report.creados_periodo.propuestas,
				},
				{
					label: 'Promociones',
					total: report.totales.promociones,
					period: report.creados_periodo.promociones,
				},
				{
					label: 'Categorías de repuestos',
					total: report.categorias?.total ?? 0,
					period: report.categorias?.creadas_periodo ?? 0,
					detail: `${formatCount(report.categorias?.activas ?? 0)} activas`,
				},
			]
		: []

	const categories = report?.categorias ?? {}
	const categoryRequests = categories.solicitudes_por_categoria ?? []

	return (
		<section className="admin-panel admin-reports" aria-labelledby="admin-reports-title">
			<div className="admin-section-heading">
				<div>
					<p className="admin-kicker">ANÁLISIS DE LA PLATAFORMA</p>
					<h2 id="admin-reports-title">Reportes de actividad</h2>
					<p>
						Consulta registros y estados actuales. Las altas del periodo se calculan por
						fecha de creación; no representan visitas ni interacciones.
					</p>
				</div>
				<button
					type="button"
					className="button button-secondary"
					onClick={() => { void loadReport() }}
					disabled={loading}
				>
					Actualizar
				</button>
			</div>

			<form
				className="admin-report-period"
				onSubmit={(event) => {
					event.preventDefault()
					void loadReport()
				}}
			>
				<label>
					Fecha inicial
					<input
						name="fechaDesde"
						type="date"
						value={period.fechaDesde}
						onChange={updatePeriod}
						required
					/>
				</label>
				<label>
					Fecha final
					<input
						name="fechaHasta"
						type="date"
						value={period.fechaHasta}
						onChange={updatePeriod}
						required
					/>
				</label>
				<button type="submit" className="button button-primary" disabled={loading}>
					Aplicar periodo
				</button>
				{report && (
					<button
						type="button"
						className="button button-secondary admin-report-export"
						onClick={exportReport}
						disabled={loading}
					>
						Exportar CSV
					</button>
				)}
			</form>

			{error && <p className="admin-alert" role="alert">{error}</p>}
			{notice && <p className="admin-notice" role="status">{notice}</p>}

			{loading ? (
				<p className="admin-report-state" role="status">Cargando estadísticas…</p>
			) : report ? (
				<>
					<p className="admin-report-meta">
						<span>
							<b>Periodo:</b>{' '}
							{dateFormatter.format(new Date(`${report.periodo.desde}T12:00:00-04:00`))}
							{' – '}
							{dateFormatter.format(new Date(`${report.periodo.hasta}T12:00:00-04:00`))}
						</span>
						<span><b>Zona:</b> {report.periodo.zona_horaria}</span>
						<span><b>Generado:</b> {dateTimeFormatter.format(new Date(report.generado_en))}</span>
					</p>

					<section
						className="admin-report-section"
						aria-labelledby="admin-report-totals-title"
					>
						<h3 id="admin-report-totals-title">
							Totales acumulados y altas del periodo
						</h3>
						<p className="admin-report-note">
							El total histórico cuenta todos los registros actuales. Las altas del
							periodo cuentan solo las filas cuya fecha de creación cae dentro del
							intervalo seleccionado.
						</p>

						<div className="admin-report-cards">
							{totalCards.map((card) => (
								<article className="admin-report-card" key={card.label}>
									<span className="admin-report-card-label">{card.label}</span>
									<strong className="admin-report-card-value">{formatCount(card.total)}</strong>
									<small>Total acumulado de registros actuales</small>
									<div className="admin-report-card-footer">
										<small><b>{formatCount(card.period)}</b> creados en el periodo</small>
										{card.detail && <small>{card.detail}</small>}
									</div>
								</article>
							))}
						</div>
					</section>

					<section
						className="admin-report-section"
						aria-labelledby="admin-report-distribution-title"
					>
						<h3 id="admin-report-distribution-title">Distribución actual</h3>
						<p className="admin-report-note">
							Estos estados describen los registros actuales; no reconstruyen
							transiciones históricas.
						</p>

						<div className="admin-report-distributions">
							{statusGroups.map(({ key, title, labels }) => (
								<article className="admin-report-distribution" key={key}>
									<h4>{title}</h4>
									<dl>
										{Object.entries(labels).map(([status, label]) => (
											<div key={status}>
												<dt>{label}</dt>
												<dd>{formatCount(report.distribucion[key][status])}</dd>
											</div>
										))}
									</dl>
								</article>
							))}
						</div>
					</section>

					<section
						className="admin-report-section"
						aria-labelledby="admin-report-categories-title"
					>
						<h3 id="admin-report-categories-title">Categorías de repuestos</h3>
						<p className="admin-report-note">
							Resumen del catálogo de categorías y cantidad de solicitudes asociadas
							a cada categoría.
						</p>

						<div className="admin-report-cards admin-report-cards-4">
							<article className="admin-report-card">
								<span className="admin-report-card-label">Categorías activas</span>
								<strong className="admin-report-card-value">{formatCount(categories.activas)}</strong>
								<small>Disponibles en el catálogo</small>
							</article>
							<article className="admin-report-card">
								<span className="admin-report-card-label">Categorías inactivas</span>
								<strong className="admin-report-card-value">{formatCount(categories.inactivas)}</strong>
								<small>No activas en el catálogo</small>
							</article>
							<article className="admin-report-card">
								<span className="admin-report-card-label">Categorías principales</span>
								<strong className="admin-report-card-value">{formatCount(categories.principales)}</strong>
								<small>No dependen de otra categoría</small>
							</article>
							<article className="admin-report-card">
								<span className="admin-report-card-label">Subcategorías</span>
								<strong className="admin-report-card-value">{formatCount(categories.subcategorias)}</strong>
								<small>Dependen de una categoría principal</small>
							</article>
						</div>

						<h4 className="admin-report-subtitle">Solicitudes por categoría</h4>

						{categoryRequests.length === 0 ? (
							<p className="admin-empty">
								No hay categorías ni solicitudes por categoría para mostrar.
							</p>
						) : (
							<div className="admin-report-table-wrap">
								<table className="admin-report-table">
									<thead>
										<tr>
											<th>Categoría</th>
											<th>Estado</th>
											<th className="is-numeric">Solicitudes</th>
										</tr>
									</thead>
									<tbody>
										{categoryRequests.map((item) => (
											<tr key={item.id}>
												<th scope="row">{item.nombre}</th>
												<td>
													<span className={`admin-report-badge${item.activa ? ' is-active' : ''}`}>
														{item.activa ? 'Activa' : 'Inactiva'}
													</span>
												</td>
												<td className="is-numeric">{formatCount(item.solicitudes)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</section>

					<section
						className="admin-report-section"
						aria-labelledby="admin-report-timeline-title"
					>
						<h3 id="admin-report-timeline-title">
							Registros creados a lo largo del periodo
						</h3>
						<p className="admin-report-note">
							Agrupación: {report.periodo.agrupacion}. Los intervalos sin registros
							muestran cero.
						</p>

						{report.serie_temporal.length === 0 ? (
							<p className="admin-empty">
								No hay intervalos que mostrar para el periodo seleccionado.
							</p>
						) : (
							<div className="admin-report-table-wrap">
								<table className="admin-report-table">
									<thead>
										<tr>
											<th>Intervalo</th>
											<th className="is-numeric">Usuarios</th>
											<th className="is-numeric">Tiendas</th>
											<th className="is-numeric">Solicitudes</th>
											<th className="is-numeric">Propuestas</th>
											<th className="is-numeric">Promociones</th>
										</tr>
									</thead>
									<tbody>
										{report.serie_temporal.map((item) => (
											<tr key={item.periodo}>
												<th scope="row">
													{dateFormatter.format(
														new Date(`${item.periodo}T12:00:00-04:00`),
													)}
												</th>
												<td className="is-numeric">{formatCount(item.usuarios)}</td>
												<td className="is-numeric">{formatCount(item.tiendas)}</td>
												<td className="is-numeric">{formatCount(item.solicitudes)}</td>
												<td className="is-numeric">{formatCount(item.propuestas)}</td>
												<td className="is-numeric">{formatCount(item.promociones)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</section>
				</>
			) : null}
		</section>
	)
}

export default AdminReportes
