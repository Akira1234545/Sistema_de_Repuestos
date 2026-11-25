import { useId, useState } from 'react'
import { changeLabel, formatCount, seriesSummary, shortDay } from '../../lib/panel.js'

// Bar anchored to the baseline with a rounded data-end (radius ≤ 4).
function barPath(x, base, width, barHeight) {
	const r = Math.min(4, barHeight, width / 2)
	const top = base - barHeight
	return `M${x} ${base} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + width - r} Q${x + width} ${top} ${x + width} ${top + r} V${base} Z`
}

// Daily bars for one real series at a time (dashboard_series). One series → no legend; the
// chips name it. Each bar is its own hover/focus target; the same numbers are in the table below.
export default function ActivityChart({ title, options, series, days, loading, error, onRetry }) {
	const [choice, setChoice] = useState(options[0]?.key)
	const [hover, setHover] = useState(null)
	const tableId = useId()
	const active = options.find((option) => option.key === choice) || options[0]
	const summary = seriesSummary(series?.[active.key], days)
	const points = summary.points
	const max = Math.max(1, ...summary.values)
	const width = 640
	const height = 180
	const gap = days > 7 ? 6 : 56 // thin marks: bars stay narrow, with a clear gap
	const barWidth = points.length ? (width - gap * (points.length - 1)) / points.length : 0
	const shown = hover != null ? points[hover] : null

	return <section className={`activity-chart glass-card${loading && series ? ' is-refreshing' : ''}`} aria-labelledby={`${tableId}-title`}>
		<div className="activity-chart-heading">
			<div>
				<h2 id={`${tableId}-title`}>{title}</h2>
				<p>{active.label}: <strong>{formatCount(summary.total)}</strong> en {days} días{summary.change != null && <> · <span className="trend-change">{summary.change > 0 ? '▲' : summary.change < 0 ? '▼' : '='} {changeLabel(summary.change)}</span> frente a los {days} anteriores</>}</p>
			</div>
			<div className="segmented" role="group" aria-label="Serie">
				{options.map((option) => <button type="button" key={option.key} aria-pressed={option.key === active.key} onClick={() => { setChoice(option.key); setHover(null) }}>{option.short || option.label}</button>)}
			</div>
		</div>
		{error && !series ? <div className="activity-state" role="alert"><p>No se pudo cargar la actividad por días.</p>{onRetry && <button className="button button-secondary" type="button" onClick={onRetry}>Reintentar</button>}</div>
			: !series ? <div className="activity-chart-plot is-placeholder" aria-hidden="true" />
				: <div className="activity-chart-plot" onPointerLeave={() => setHover(null)}>
					<span className="activity-chart-max" aria-hidden="true">{formatCount(max)}</span>
					<svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${active.label} por día, últimos ${days} días. Valores en la tabla de datos.`}>
						<line className="activity-chart-grid" x1="0" x2={width} y1="0.5" y2="0.5" />
						<line className="activity-chart-base" x1="0" x2={width} y1={height - 0.5} y2={height - 0.5} />
						{points.map((point, index) => {
							const barHeight = point.total ? Math.max(4, (point.total / max) * (height - 8)) : 0
							const x = index * (barWidth + gap)
							return <g key={point.dia} className={`activity-chart-bar${hover === index ? ' is-active' : ''}`}
								tabIndex={0} aria-label={`${shortDay(point.dia)}: ${point.total}`}
								onPointerEnter={() => setHover(index)} onFocus={() => setHover(index)} onBlur={() => setHover(null)}>
								<rect className="activity-chart-hit" x={x - gap / 2} y="0" width={barWidth + gap} height={height} />
								{barHeight > 0 && <path d={barPath(x, height, barWidth, barHeight)} />}
							</g>
						})}
					</svg>
					{shown && <div className="activity-chart-tooltip" role="status" style={{ left: `${((hover + .5) / points.length) * 100}%` }}>
						<strong>{formatCount(shown.total)}</strong><span>{shortDay(shown.dia)}</span>
					</div>}
					<div className="activity-chart-axis" aria-hidden="true"><span>{shortDay(points[0]?.dia)}</span><span>Hoy</span></div>
				</div>}
		{series && <details className="activity-chart-table">
			<summary>Ver datos</summary>
			<table>
				<caption className="visually-hidden">{active.label} por día</caption>
				<thead><tr><th scope="col">Día</th><th scope="col">{active.label}</th></tr></thead>
				<tbody>{points.map((point) => <tr key={point.dia}><td>{shortDay(point.dia)}</td><td>{formatCount(point.total)}</td></tr>)}</tbody>
			</table>
		</details>}
	</section>
}
