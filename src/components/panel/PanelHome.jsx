import { Link } from 'react-router-dom'
import Icon from '../Icon.jsx'
import ProgressRing from '../ui/ProgressRing.jsx'
import RollingNumber from '../ui/RollingNumber.jsx'
import Sparkline from '../ui/Sparkline.jsx'
import { attentionLine, changeLabel, boliviaHour, greetingFor, timeAgo, todayLabel } from '../../lib/panel.js'

// Building blocks shared by the client, store and admin homes (sesión 7, paneles «glass»).
// Every number shown here comes from the caller's real data; nothing is estimated.

export function PanelGreeting({ name, attention, loading, children }) {
	const greeting = `${greetingFor(boliviaHour())}${name ? `, ${name}` : ''}`
	return <header className="panel-greeting">
		<div>
			<p className="panel-greeting-date">{todayLabel()}</p>
			<h1>{greeting}</h1>
			{/* attention = null when the data failed to load: say nothing rather than «nada pendiente». */}
			{(loading || attention != null) && <p className="panel-greeting-attention" aria-live="polite">
				{loading ? 'Revisando tu actividad…' : <>{Number(attention) > 0 && <span className="panel-attention-dot" aria-hidden="true" />}{attentionLine(attention)}</>}
			</p>}
		</div>
		{children && <div className="panel-greeting-actions">{children}</div>}
	</header>
}

export function PanelHero({ id, kicker, title, lead, metrics = [], actions, ring, loading }) {
	return <section className="panel-hero section-dark" aria-labelledby={id}>
		<div className="panel-hero-body">
			{kicker && <p className="panel-hero-kicker">{kicker}</p>}
			<h2 id={id}>{title}</h2>
			{lead && <p className="panel-hero-lead">{lead}</p>}
			{metrics.length > 0 && <dl className="panel-hero-metrics">
				{metrics.map((metric) => <div key={metric.label}>
					<dt>{metric.label}</dt>
					<dd>{loading || metric.value == null ? '—' : <RollingNumber value={metric.value} decimals={metric.decimals || 0} />}</dd>
				</div>)}
			</dl>}
			{actions && <div className="panel-hero-actions">{actions}</div>}
		</div>
		{ring && <ProgressRing loading={loading} {...ring} />}
	</section>
}

// Short list of the latest real events (notifications, or recent stores for the admin).
export function ActivityCard({ title = 'Actividad reciente', items, loading, error, onRetry, empty, footer }) {
	return <section className="activity-card glass-card" aria-labelledby="activity-title" aria-busy={loading}>
		<div className="activity-card-heading">
			<h2 id="activity-title">{title}</h2>
			{footer}
		</div>
		{loading ? <ul className="activity-list" aria-hidden="true">{[0, 1, 2].map((key) => <li className="activity-item is-placeholder" key={key}><span /><div><i /><i /></div></li>)}</ul>
			: error ? <div className="activity-state" role="alert"><p>{error}</p>{onRetry && <button className="button button-secondary" type="button" onClick={onRetry}>Reintentar</button>}</div>
				: !items?.length ? <p className="activity-state">{empty}</p>
					: <ul className="activity-list">
						{items.map((item) => {
							const body = <>
								<span className={`activity-icon${item.unread ? ' is-unread' : ''}`} aria-hidden="true"><Icon name={item.icon || 'bell'} size={16} /></span>
								<div className="activity-text">
									<strong>{item.title}</strong>
									{item.text && <span>{item.text}</span>}
								</div>
								{item.date && <time dateTime={item.date}>{timeAgo(item.date)}</time>}
								{item.unread && <span className="visually-hidden">(sin leer)</span>}
							</>
							return <li className="activity-item" key={item.id}>
								{item.to ? <Link to={item.to}>{body}</Link> : item.onClick ? <button type="button" onClick={item.onClick}>{body}</button> : <div>{body}</div>}
							</li>
						})}
					</ul>}
	</section>
}

// Row of four KPI cards; one may be `highlight` (yellow). Values roll in with RollingNumber.
export function KpiRow({ items, loading, label = 'Indicadores' }) {
	return <section className="kpi-row" aria-label={label} aria-busy={loading}>
		{items.map((item) => {
			const body = <>
				<span className="kpi-icon" aria-hidden="true"><Icon name={item.icon} size={18} /></span>
				<strong className="kpi-value">
					{loading || item.value == null ? '—' : <RollingNumber value={item.value} decimals={item.decimals || 0} />}
					{item.suffix && !loading && item.value != null && <small>{item.suffix}</small>}
				</strong>
				<span className="kpi-label">{item.label}</span>
				{item.hint && <em className="kpi-hint">{item.hint}</em>}
				{item.trend && <span className="kpi-trend">
					<Sparkline values={item.trend.values} />
					<span className="kpi-trend-text">
						{item.trend.text}
						{item.trend.change != null && <b> · {item.trend.change > 0 ? '▲' : item.trend.change < 0 ? '▼' : '='} {changeLabel(item.trend.change)}</b>}
						{item.trend.change != null && <span className="visually-hidden"> frente al periodo anterior</span>}
					</span>
				</span>}
				{(item.to || item.onClick) && <span className="kpi-arrow" aria-hidden="true">↗</span>}
			</>
			const className = `kpi-card ${item.highlight ? 'is-highlight' : 'glass-card'}`
			if (item.to) return <Link className={className} to={item.to} key={item.label}>{body}</Link>
			if (item.onClick) return <button className={className} type="button" onClick={item.onClick} key={item.label}>{body}</button>
			return <div className={className} key={item.label}>{body}</div>
		})}
	</section>
}

// One row above the KPI: the period that scopes every trend below (7 or 30 days).
export function PeriodControl({ days, onChange, busy }) {
	return <div className="panel-period">
		<h2 className="panel-period-title">Tendencia</h2>
		<div className="segmented" role="group" aria-label="Periodo de las tendencias" aria-busy={busy}>
			{[7, 30].map((value) => <button type="button" key={value} aria-pressed={days === value} onClick={() => onChange(value)}>{value} días</button>)}
		</div>
	</div>
}
