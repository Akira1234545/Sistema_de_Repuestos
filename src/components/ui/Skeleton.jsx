// Placeholder cards shown while a list loads; hidden from assistive tech, which gets the status text.
export default function SkeletonList({ count = 3, variant = 'row', label = 'Cargando…' }) {
	return <div className={`skeleton-list skeleton-${variant}`}>
		<span className="visually-hidden" role="status">{label}</span>
		{Array.from({ length: count }, (_, index) => <div className="skeleton-card" aria-hidden="true" key={index}>
			<span className="skeleton-line skeleton-line-short" />
			<span className="skeleton-line skeleton-line-title" />
			<span className="skeleton-line" />
			<span className="skeleton-line skeleton-line-mid" />
		</div>)}
	</div>
}
