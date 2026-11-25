import { useEffect, useRef } from 'react'

// E31 (sesión 8): registro común de «capas abiertas» (visor de fotos, menú de cuenta,
// buscador, selector, notificaciones, menú móvil y diálogos de confirmación).
// Escape en la web y el botón atrás de Android cierran solo la capa de arriba;
// cada capa devuelve el foco al elemento que la abrió.
const stack = []

export function pushLayer(close) {
	const entry = { close }
	stack.push(entry)
	return () => {
		const index = stack.indexOf(entry)
		if (index >= 0) stack.splice(index, 1)
	}
}

// Devuelve true si había una capa que cerrar (para que el botón atrás no navegue).
export function closeTopLayer() {
	const top = stack.at(-1)
	if (!top) return false
	top.close()
	return true
}

export function hasOpenLayer() {
	return stack.length > 0
}

if (typeof window !== 'undefined') {
	// Fase de captura: la capa de arriba gana aunque el foco esté en otra.
	window.addEventListener('keydown', (event) => {
		if (event.key !== 'Escape' || event.defaultPrevented || !stack.length) return
		event.preventDefault()
		event.stopPropagation()
		closeTopLayer()
	}, true)
}

// Registra la capa mientras `open` sea true. `onClose` puede cambiar en cada render.
export function useLayer(open, onClose, { restoreFocus = true } = {}) {
	const closeRef = useRef(onClose)
	useEffect(() => { closeRef.current = onClose })
	useEffect(() => {
		if (!open) return undefined
		const opener = document.activeElement
		const remove = pushLayer(() => closeRef.current?.())
		return () => {
			remove()
			if (!restoreFocus || !(opener instanceof HTMLElement) || !opener.isConnected) return
			// Solo si el foco se perdió con la capa; no se lo quita a un campo que el usuario eligió.
			const current = document.activeElement
			if (!current || current === document.body || !current.isConnected) opener.focus({ preventScroll: true })
		}
	}, [open, restoreFocus])
}
