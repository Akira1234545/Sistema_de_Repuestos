import { useEffect } from 'react'

// Arrastrar con el mouse para desplazar en horizontal (sesión 8). En pantallas táctiles el
// desplazamiento nativo ya funciona; aquí solo se añade el arrastre con mouse o lápiz.
// Si hubo arrastre, se cancela el clic para no abrir la tarjeta al soltar.
export function useDragScroll(ref, active = true) {
	useEffect(() => {
		const element = ref.current
		if (!element || !active) return undefined
		let startX = 0
		let startScroll = 0
		let dragging = false
		let moved = false

		function down(event) {
			if (event.pointerType === 'touch' || event.button !== 0) return
			dragging = true
			moved = false
			startX = event.clientX
			startScroll = element.scrollLeft
			element.classList.add('is-grabbing')
		}
		function move(event) {
			if (!dragging) return
			const delta = event.clientX - startX
			if (Math.abs(delta) > 6) moved = true
			if (moved) {
				element.scrollLeft = startScroll - delta
				event.preventDefault()
			}
		}
		function up() {
			dragging = false
			element.classList.remove('is-grabbing')
		}
		function click(event) {
			if (moved) { event.preventDefault(); event.stopPropagation(); moved = false }
		}
		function dragstart(event) { event.preventDefault() }

		element.addEventListener('pointerdown', down)
		window.addEventListener('pointermove', move, { passive: false })
		window.addEventListener('pointerup', up)
		element.addEventListener('click', click, true)
		element.addEventListener('dragstart', dragstart)
		return () => {
			element.removeEventListener('pointerdown', down)
			window.removeEventListener('pointermove', move)
			window.removeEventListener('pointerup', up)
			element.removeEventListener('click', click, true)
			element.removeEventListener('dragstart', dragstart)
		}
	}, [ref, active])
}
