// Tiny single-series trend line for a KPI card (decorative: the card states the numbers in text).
// Thin 2 px line, a light area under it and an 8 px dot on the last day.
export default function Sparkline({ values = [] }) {
	if (values.length < 2) return null
	const width = 120
	const height = 36
	const pad = 5
	const max = Math.max(1, ...values)
	const x = (index) => pad + (index * (width - pad * 2)) / (values.length - 1)
	const y = (value) => height - pad - (value / max) * (height - pad * 2)
	const line = values.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ')
	const area = `${line} L${x(values.length - 1).toFixed(1)} ${height - pad} L${x(0).toFixed(1)} ${height - pad} Z`
	return <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
		<path className="sparkline-area" d={area} />
		<path className="sparkline-line" d={line} vectorEffect="non-scaling-stroke" />
		<circle className="sparkline-dot" cx={x(values.length - 1)} cy={y(values.at(-1))} r="4" vectorEffect="non-scaling-stroke" />
	</svg>
}
