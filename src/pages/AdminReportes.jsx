import { publicError } from '../lib/errors.js'

import { useCallback, useEffect, useRef, useState } from 'react'
import { obtenerReportesActividadAdministracion } from '../services/adminService.js'
import { isNativeApp } from '../lib/platform.js'
import { buildCsv, buildWorkbook, downloadBlob } from '../lib/xlsx.js'
import { buildPrintHtml, printReport } from '../lib/reportPrint.js'

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
	aceptada: 'Seleccionadas',
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

const count = (value) => Number(value ?? 0) || 0
const dayFormatter = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const monthFormatter = new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// «2026-11-24» → «24 nov 2026» (la fecha ya viene en hora de Bolivia; UTC solo evita correrla un día).
function dayLabel(isoDate) {
	const date = new Date(`${String(isoDate).slice(0, 10)}T00:00:00Z`)
	return Number.isNaN(date.getTime()) ? String(isoDate ?? '') : dayFormatter.format(date)
}

function intervalLabel(isoDate, grouping) {
	if (grouping === 'mes') {
		const date = new Date(`${String(isoDate).slice(0, 10)}T00:00:00Z`)
		if (!Number.isNaN(date.getTime())) {
			const label = monthFormatter.format(date)
			return label[0].toLocaleUpperCase('es') + label.slice(1)
		}
	}
	return grouping === 'semana' ? `Semana del ${dayLabel(isoDate)}` : dayLabel(isoDate)
}

// Sesión 8: un solo modelo del reporte para el .xlsx (con formato) y el .csv (solo datos).
function reportDocument(report) {
	const generatedAt = new Date(report.generado_en)
	const generatedLabel = Number.isNaN(generatedAt.getTime()) ? report.generado_en : dateTimeFormatter.format(generatedAt)
	const categories = report.categorias ?? {}
	const grouping = report.periodo.agrupacion
	const num = (label) => ({ label, numeric: true })
	const text = (label) => ({ label })

	return {
		sheetName: 'Reporte de actividad',
		title: 'DriveFix · Reporte de actividad',
		meta: [
			`Periodo: ${dayLabel(report.periodo.desde)} – ${dayLabel(report.periodo.hasta)} · Agrupado por ${grouping}`,
			`Generado: ${generatedLabel} (hora de Bolivia)`,
		],
		sections: [
			{
				title: 'Resumen de la plataforma',
				columns: [text('Indicador'), num('Total actual'), num('Creados en el periodo')],
				rows: [
					['Usuarios', count(report.totales.usuarios), count(report.creados_periodo.usuarios)],
					['Tiendas', count(report.totales.tiendas), count(report.creados_periodo.tiendas)],
					['Tiendas activas y aprobadas', count(report.totales.tiendas_activas), ''],
					['Solicitudes', count(report.totales.solicitudes), count(report.creados_periodo.solicitudes)],
					['Propuestas', count(report.totales.propuestas), count(report.creados_periodo.propuestas)],
					['Promociones', count(report.totales.promociones), count(report.creados_periodo.promociones)],
					['Categorías de repuestos', count(categories.total), count(categories.creadas_periodo)],
				],
			},
			{
				title: 'Categorías',
				columns: [text('Métrica'), num('Cantidad')],
				rows: [
					['Activas', count(categories.activas)],
					['Inactivas', count(categories.inactivas)],
					['Principales', count(categories.principales)],
					['Subcategorías', count(categories.subcategorias)],
				],
			},
			{
				title: 'Solicitudes por categoría (creadas en el periodo)',
				columns: [text('Categoría'), text('Estado'), num('Solicitudes')],
				rows: (categories.solicitudes_por_categoria ?? []).map((item) => [item.nombre, item.activa ? 'Activa' : 'Inactiva', count(item.solicitudes)]),
				empty: 'Ninguna solicitud nueva en este periodo.',
			},
			{
				title: 'Distribución actual por estado o rol',
				columns: [text('Grupo'), text('Estado o rol'), num('Cantidad')],
				rows: statusGroups.flatMap(({ key, title, labels }) =>
					Object.entries(labels).map(([status, label]) => [title, label, count(report.distribucion[key]?.[status])])),
			},
			{
				title: `Registros creados por ${grouping}`,
				columns: [text(grouping === 'mes' ? 'Mes' : grouping === 'semana' ? 'Semana' : 'Día'), num('Usuarios'), num('Tiendas'), num('Solicitudes'), num('Propuestas'), num('Promociones')],
				rows: report.serie_temporal.map((item) => [
					intervalLabel(item.periodo, grouping),
					count(item.usuarios), count(item.tiendas), count(item.solicitudes), count(item.propuestas), count(item.promociones),
				]),
			},
		],
	}
}

function AdminReportes() {
	const requestVersion = useRef(0)
	useEffect(() => () => { requestVersion.current += 1 }, [])
	const [period, setPeriod] = useState(initialPeriod)
	const [report, setReport] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [showAllCategories, setShowAllCategories] = useState(false)

	const loadReport = useCallback(async () => {
		const version = ++requestVersion.current
		if (!period.fechaDesde || !period.fechaHasta) {
			setError('Selecciona una fecha inicial y una fecha final.')
			setReport(null)
			if (version === requestVersion.current) setLoading(false)
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
			const loadedReport = await obtenerReportesActividadAdministracion(period.fechaDesde, period.fechaHasta)
			if (version !== requestVersion.current) return
			setReport(loadedReport)
		} catch (cause) {
			if (version !== requestVersion.current) return
			setReport(null)
			setError(`No se pudieron cargar los reportes de actividad: ${publicError(cause)}`)
		} finally {
			if (version === requestVersion.current) setLoading(false)
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

	function exportReport(format) {
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

		const doc = reportDocument(report)
		const name = `drivefix_reporte_${report.periodo.desde}_${report.periodo.hasta}`
		if (format === 'xlsx') downloadBlob(buildWorkbook(doc), `${name}.xlsx`)
		else if (format === 'pdf') printReport(buildPrintHtml(doc, name))
		else downloadBlob(buildCsv(doc), `${name}.csv`)
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
	const rankedCategories = [...categoryRequests].sort((a, b) => Number(b.solicitudes) - Number(a.solicitudes) || a.nombre.localeCompare(b.nombre, 'es'))
	const categoriesWithRequests = rankedCategories.filter((item) => Number(item.solicitudes) > 0)
	const visibleCategories = showAllCategories ? rankedCategories : categoriesWithRequests
	const maxCategoryRequests = Math.max(1, ...rankedCategories.map((item) => Number(item.solicitudes) || 0))

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
				{/* E39: el WebView de Android no descarga blob: con <a download> y la app no trae
				    @capacitor/filesystem; en la app se pide exportar desde la web. */}
				{report && isNativeApp && <p className="admin-report-native-note" role="note">Exporta el reporte desde la web: la app todavía no guarda archivos.</p>}
				{/* Sesión 8: Excel con formato, versión imprimible (Guardar como PDF) y CSV solo con datos. */}
				{report && !isNativeApp && (
					<div className="admin-report-export" role="group" aria-label="Exportar reporte">
						<button type="button" className="button button-secondary" onClick={() => exportReport('xlsx')} disabled={loading}>
							Exportar Excel
						</button>
						<button type="button" className="button button-secondary" onClick={() => exportReport('pdf')} disabled={loading}
							title="Abre la impresión del navegador; elige «Guardar como PDF»">
							Imprimir / PDF
						</button>
						<button type="button" className="button button-secondary" onClick={() => exportReport('csv')} disabled={loading}
							title="Solo datos, separados por punto y coma">
							CSV
						</button>
					</div>
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
							Resumen del catálogo actual y de las solicitudes creadas en el periodo
							seleccionado para cada categoría.
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

						<h4 className="admin-report-subtitle">Solicitudes creadas en el periodo, por categoría</h4>

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
										{visibleCategories.map((item) => (
											<tr key={item.id}>
												<th scope="row">{item.nombre}</th>
												<td>
													<span className={`admin-report-badge${item.activa ? ' is-active' : ''}`}>
														{item.activa ? 'Activa' : 'Inactiva'}
													</span>
												</td>
												<td className="is-numeric">
													<span className="admin-report-bar" aria-hidden="true"><i style={{ '--share': Number(item.solicitudes) / maxCategoryRequests }} /></span>
													{formatCount(item.solicitudes)}
												</td>
											</tr>
										))}
										{visibleCategories.length === 0 && (
											<tr><td colSpan="3">No se crearon solicitudes en este periodo. Amplía las fechas para ver más.</td></tr>
										)}
									</tbody>
								</table>
							</div>
						)}
						{categoryRequests.length > categoriesWithRequests.length && (
							<button type="button" className="button button-secondary admin-report-toggle" aria-expanded={showAllCategories} onClick={() => setShowAllCategories((value) => !value)}>
								{showAllCategories
									? 'Mostrar solo categorías con solicitudes'
									: `Ver las ${formatCount(categoryRequests.length)} categorías`}
							</button>
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
