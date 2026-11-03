import { useEffect, useId, useMemo, useRef, useState } from 'react'

const SEARCH_THRESHOLD = 8

// Styled replacement for <select>: a menu on wide screens and a bottom sheet on phones,
// so the native Android picker never clashes with the app. onChange receives an
// event-like { target: { name, value } } so it drops into existing form handlers.
export default function Select({ name, value = '', onChange, options, placeholder = 'Selecciona', disabled = false, required = false, id, className = '', ariaLabel }) {
	const autoId = useId()
	const buttonId = id || `${autoId}-button`
	const listId = `${autoId}-list`
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const [active, setActive] = useState(0)
	const rootRef = useRef(null)
	const buttonRef = useRef(null)
	const searchRef = useRef(null)
	const listRef = useRef(null)
	const selected = options.find((option) => String(option.value) === String(value))
	const searchable = options.length > SEARCH_THRESHOLD
	const visible = useMemo(() => {
		const term = query.trim().toLocaleLowerCase('es')
		return term ? options.filter((option) => option.label.toLocaleLowerCase('es').includes(term)) : options
	}, [options, query])

	useEffect(() => {
		if (!open) return undefined
		function onPointer(event) { if (!rootRef.current?.contains(event.target)) setOpen(false) }
		document.addEventListener('pointerdown', onPointer)
		return () => document.removeEventListener('pointerdown', onPointer)
	}, [open])

	useEffect(() => {
		if (!open) return
		if (searchable) searchRef.current?.focus({ preventScroll: true })
		else listRef.current?.focus({ preventScroll: true })
		listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
	}, [open, searchable])

	function openMenu() {
		if (disabled) return
		setQuery('')
		setActive(Math.max(0, options.findIndex((option) => String(option.value) === String(value))))
		setOpen(true)
	}
	function close(focusButton = true) {
		setOpen(false)
		if (focusButton) buttonRef.current?.focus({ preventScroll: true })
	}
	function choose(option) {
		onChange?.({ target: { name, value: option.value } })
		close()
	}
	function onKeyDown(event) {
		if (!open) {
			if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); openMenu() }
			return
		}
		if (event.key === 'Escape') { event.preventDefault(); close() }
		else if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(visible.length - 1, index + 1)) }
		else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(0, index - 1)) }
		else if (event.key === 'Enter') { event.preventDefault(); if (visible[active]) choose(visible[active]) }
		else if (event.key === 'Tab') close(false)
	}

	return <div className={`ui-select${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`} ref={rootRef} onKeyDown={onKeyDown}>
		<button ref={buttonRef} id={buttonId} type="button" className="ui-select-button" disabled={disabled}
			aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-label={ariaLabel}
			onClick={() => (open ? close() : openMenu())}>
			<span className={selected ? '' : 'is-placeholder'}>{selected ? selected.label : placeholder}</span>
			<svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
		</button>
		{/* Keeps native "required" validation without showing the browser control. */}
		{required && <input className="ui-select-validator" tabIndex={-1} aria-hidden="true" required value={value} onChange={() => {}} onFocus={() => buttonRef.current?.focus()} />}
		{open && <>
			<div className="ui-select-backdrop" onClick={() => close()} />
			<div className="ui-select-panel" role="presentation">
				<div className="ui-select-sheet-head"><strong>{ariaLabel || placeholder}</strong><button type="button" className="ui-select-close" onClick={() => close()} aria-label="Cerrar">✕</button></div>
				{searchable && <input ref={searchRef} className="ui-select-search" type="search" value={query} placeholder="Buscar…" aria-label="Buscar opción" aria-controls={listId}
					onChange={(event) => { setQuery(event.target.value); setActive(0) }} />}
				<ul ref={listRef} id={listId} role="listbox" tabIndex={-1} aria-labelledby={buttonId} className="ui-select-list">
					{visible.map((option, index) => {
						const isSelected = String(option.value) === String(value)
						return <li key={option.value === '' ? '__empty' : option.value} role="option" aria-selected={isSelected}
							className={`${index === active ? 'is-active' : ''}${isSelected ? ' is-selected' : ''}`}
							onPointerEnter={() => setActive(index)} onClick={() => choose(option)}>
							<span>{option.label}</span>{isSelected && <span aria-hidden="true">✓</span>}
						</li>
					})}
					{!visible.length && <li className="ui-select-empty" role="presentation">Sin resultados</li>}
				</ul>
			</div>
		</>}
	</div>
}
