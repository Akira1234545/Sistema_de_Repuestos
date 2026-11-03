import { Link } from 'react-router-dom'
import CountUp from './CountUp.jsx'

// Row of live metrics; each item may link to the screen where the number comes from.
export default function StatStrip({ items, loading }) {
	return <div className="stat-strip" aria-busy={loading}>
		{items.map((item) => {
			const body = <>
				<strong>{loading || item.value == null ? '—' : <CountUp value={item.value} decimals={item.decimals || 0} />}{item.suffix && !loading && item.value != null ? <small>{item.suffix}</small> : null}</strong>
				<span>{item.label}</span>
				{item.hint && <em>{item.hint}</em>}
			</>
			return item.to
				? <Link className={`stat-tile${item.highlight ? ' is-highlight' : ''}`} to={item.to} key={item.label}>{body}</Link>
				: <div className={`stat-tile${item.highlight ? ' is-highlight' : ''}`} key={item.label}>{body}</div>
		})}
	</div>
}
