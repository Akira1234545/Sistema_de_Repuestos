import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon.jsx'
import { useAuth } from '../context/authState.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { statusLabel } from '../lib/format.js'
import { vehicleName } from '../lib/vehicles.js'
import { obtenerSolicitudesDisponibles, obtenerSolicitudesUsuario } from '../services/solicitudService.js'
import { obtenerVehiculosUsuario } from '../services/vehiculoService.js'
import { obtenerTiendasPublicas } from '../services/tiendaService.js'
import { obtenerPromocionesDisponibles } from '../services/promocionService.js'

const LIMIT = 4

// Each source returns { title, items: [{ id, label, hint, to }] } for the query.
function sourcesFor(role, userId) {
	const promotions = { title: 'Promociones', icon: 'promotion', load: async (q) => (await obtenerPromocionesDisponibles(0, q)).items.map((item) => ({ id: item.id, label: item.titulo, hint: item.categoriaNombre || item.marca || '', to: `/promociones/${item.id}` })) }
	if (role === 'tienda') return [
		{ title: 'Solicitudes disponibles', icon: 'requests', load: async (q) => (await obtenerSolicitudesDisponibles(0, { search: q })).items.map((item) => ({ id: item.id, label: item.titulo, hint: item.categoriaNombre || statusLabel(item.estado), to: `/tienda/solicitudes/${item.id}` })) },
		promotions,
	]
	let vehicles = null
	return [
		{ title: 'Mis solicitudes', icon: 'requests', load: async (q) => (await obtenerSolicitudesUsuario(userId, 0, { search: q })).items.map((item) => ({ id: item.id, label: item.titulo, hint: statusLabel(item.estado), to: `/cliente/solicitudes/${item.id}/propuestas` })) },
		{ title: 'Mis vehículos', icon: 'vehicle', load: async (q) => {
			vehicles ||= (await obtenerVehiculosUsuario(userId, 0)).items
			const term = q.toLocaleLowerCase('es')
			return vehicles.filter((item) => `${vehicleName(item)} ${item.anio} ${item.tipoNombre || ''}`.toLocaleLowerCase('es').includes(term))
				.map((item) => ({ id: item.id, label: vehicleName(item), hint: String(item.anio), to: `/cliente/vehiculos/${item.id}` }))
		} },
		{ title: 'Tiendas', icon: 'store', load: async (q) => (await obtenerTiendasPublicas(0, q)).items.map((item) => ({ id: item.id, label: item.nombre, hint: item.horario || '', to: `/cliente/tiendas#${item.id}` })) },
		promotions,
	]
}

export default function GlobalSearch({ className = '' }) {
	const { role, user } = useAuth()
	const navigate = useNavigate()
	const listId = useId()
	const rootRef = useRef(null)
	const inputRef = useRef(null)
	const sourcesRef = useRef(null)
	const [query, setQuery] = useState('')
	const [open, setOpen] = useState(false)
	const [groups, setGroups] = useState([])
	const [loading, setLoading] = useState(false)
	const [active, setActive] = useState(0)
	const term = useDebouncedValue(query.trim(), 250)
	const ready = term.length >= 2
	const shown = ready ? groups : []
	const flat = shown.flatMap((group) => group.items)
	const placeholder = role === 'tienda' ? 'Buscar solicitudes o promociones' : 'Buscar solicitudes, vehículos, tiendas…'

	useEffect(() => {
		if (term.length < 2) return undefined
		let alive = true
		sourcesRef.current ||= sourcesFor(role, user?.id)
		Promise.resolve().then(() => { if (alive) setLoading(true) })
		Promise.allSettled(sourcesRef.current.map((source) => source.load(term))).then((results) => {
			if (!alive) return
			setGroups(sourcesRef.current.map((source, index) => ({
				title: source.title, icon: source.icon,
				items: results[index].status === 'fulfilled' ? results[index].value.slice(0, LIMIT) : [],
			})).filter((group) => group.items.length))
			setActive(0)
			setLoading(false)
		})
		return () => { alive = false }
	}, [term, role, user?.id])

	useEffect(() => {
		if (!open) return undefined
		function onPointer(event) { if (!rootRef.current?.contains(event.target)) setOpen(false) }
		document.addEventListener('pointerdown', onPointer)
		return () => document.removeEventListener('pointerdown', onPointer)
	}, [open])

	function go(item) { setOpen(false); setQuery(''); inputRef.current?.blur(); navigate(item.to) }
	function onKeyDown(event) {
		if (event.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
		else if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive((index) => Math.min(flat.length - 1, index + 1)) }
		else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(0, index - 1)) }
		else if (event.key === 'Enter') { event.preventDefault(); if (flat[active]) go(flat[active]) }
	}

	const showPanel = open && ready
	const offsets = shown.map((_, groupIndex) => shown.slice(0, groupIndex).reduce((total, group) => total + group.items.length, 0))
	return <div className={`global-search ${className}`} ref={rootRef}>
		<label className="global-search-field">
			<Icon name="search" size={18} />
			<input ref={inputRef} type="search" value={query} maxLength={80} placeholder={placeholder} aria-label={placeholder}
				role="combobox" aria-expanded={showPanel} aria-controls={listId} aria-autocomplete="list"
				onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true) }} onKeyDown={onKeyDown} />
			{query && <button type="button" className="global-search-clear" aria-label="Borrar búsqueda" onClick={() => { setQuery(''); inputRef.current?.focus() }}><Icon name="x" size={16} /></button>}
		</label>
		{showPanel && <div className="global-search-panel" id={listId} role="listbox" aria-label="Resultados">
			{loading && !shown.length && <p className="global-search-state" role="status">Buscando…</p>}
			{!loading && !shown.length && <p className="global-search-state">Sin resultados para «{term}».</p>}
			{shown.map((group, groupIndex) => <section key={group.title} className="global-search-group">
				<h3><Icon name={group.icon} size={14} /> {group.title}</h3>
				{group.items.map((item, itemIndex) => {
					const position = offsets[groupIndex] + itemIndex
					return <button key={`${group.title}-${item.id}`} type="button" role="option" aria-selected={position === active}
						className={position === active ? 'is-active' : ''} onPointerEnter={() => setActive(position)} onClick={() => go(item)}>
						<span>{item.label}</span>{item.hint && <small>{item.hint}</small>}
					</button>
				})}
			</section>)}
		</div>}
	</div>
}
