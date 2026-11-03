import Icon from '../Icon.jsx'

// Segmented icon control for list layouts; options: [{ value, label, icon }].
export default function ViewSwitcher({ value, onChange, options, label = 'Vista' }) {
	return <div className="view-switcher" role="radiogroup" aria-label={label}>
		{options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} aria-label={option.label} title={option.label}
			className={value === option.value ? 'is-active' : ''} onClick={() => onChange(option.value)}>
			<Icon name={option.icon} size={18} />
		</button>)}
	</div>
}
