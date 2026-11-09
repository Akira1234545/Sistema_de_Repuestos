// Ventilated brake disc, caliper and pads drawn in SVG. Each part is a named group
// so the landing page can assemble it on scroll. Purely decorative.
// DriveFix: la pinza usa el amarillo de destaque (--highlight #FFC72C); los metálicos se mantienen.
const CENTER = 200
const polar = (radius, degrees) => {
	const angle = (degrees * Math.PI) / 180
	return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)]
}
const arc = (radius, from, to) => {
	const [x1, y1] = polar(radius, from)
	const [x2, y2] = polar(radius, to)
	return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
}
const drilled = [...Array(24)].map((_, index) => polar(index % 2 ? 128 : 108, index * 15 + (index % 2 ? 7.5 : 0)))
const vents = [...Array(36)].map((_, index) => index * 10)
const lugs = [...Array(5)].map((_, index) => polar(38, index * 72 - 90))

export default function BrakeAssembly({ idPrefix = 'brake', className = '' }) {
	const metal = `${idPrefix}-metal`
	const amber = `${idPrefix}-amber`
	const glow = `${idPrefix}-glow`
	return <svg className={`brake-assembly ${className}`} viewBox="0 0 400 400" aria-hidden="true" focusable="false">
		<defs>
			<radialGradient id={metal} cx="40%" cy="35%" r="75%">
				<stop offset="0" stopColor="#5d6676" />
				<stop offset=".55" stopColor="#2c323d" />
				<stop offset="1" stopColor="#181c23" />
			</radialGradient>
			<linearGradient id={amber} x1="0" y1="0" x2="1" y2="1">
				<stop offset="0" stopColor="#FFDA6B" />
				<stop offset=".6" stopColor="#FFC72C" />
				<stop offset="1" stopColor="#C9961F" />
			</linearGradient>
			<filter id={glow} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10" /></filter>
		</defs>
		<g data-part="heat" opacity="0">
			<circle cx={CENTER} cy={CENTER} r="150" fill="none" stroke="#FFC72C" strokeWidth="18" filter={`url(#${glow})`} />
		</g>
		<g data-part="rotor">
			<circle cx={CENTER} cy={CENTER} r="160" fill={`url(#${metal})`} stroke="#4a5262" strokeWidth="1.5" />
			<circle cx={CENTER} cy={CENTER} r="152" fill="none" stroke="#6b7484" strokeWidth=".8" opacity=".6" />
			{vents.map((degrees) => {
				const [x1, y1] = polar(88, degrees)
				const [x2, y2] = polar(156, degrees + 12)
				return <line key={degrees} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#12151b" strokeWidth="1.2" opacity=".55" />
			})}
			{drilled.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="4.2" fill="#0E1726" stroke="#3d4553" strokeWidth=".8" />)}
			<circle cx={CENTER} cy={CENTER} r="82" fill="#1d222b" stroke="#4a5262" strokeWidth="1.5" />
			<circle cx={CENTER} cy={CENTER} r="64" fill={`url(#${metal})`} stroke="#5a6373" strokeWidth="1" />
			{lugs.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="7" fill="#0E1726" stroke="#7a8392" strokeWidth="1.2" />)}
			<circle cx={CENTER} cy={CENTER} r="18" fill="#0E1726" stroke="#7a8392" strokeWidth="1.5" />
		</g>
		<g data-part="pads">
			<path d={arc(146, -58, 8)} fill="none" stroke="#9aa6b8" strokeWidth="20" strokeLinecap="round" />
			<path d={arc(146, -58, 8)} fill="none" stroke="#3b4350" strokeWidth="2" strokeDasharray="2 10" />
		</g>
		<g data-part="caliper">
			<path d={arc(150, -68, 18)} fill="none" stroke="#000" strokeOpacity=".45" strokeWidth="62" strokeLinecap="round" transform="translate(4 8)" />
			<path d={arc(150, -68, 18)} fill="none" stroke={`url(#${amber})`} strokeWidth="58" strokeLinecap="round" />
			<path d={arc(150, -62, 12)} fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth="3" strokeLinecap="round" transform="translate(0 -14)" />
			{[-58, -25, 8].map((degrees) => {
				const [x, y] = polar(150, degrees)
				return <circle key={degrees} cx={x} cy={y} r="6" fill="#0E1726" stroke="#FFDA6B" strokeWidth="1.5" />
			})}
		</g>
	</svg>
}
