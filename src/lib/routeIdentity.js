// Moves focus to the page heading and names the browser tab after it, so screen
// reader and keyboard users land on the new content after client-side navigation.
export function announceRoute() {
	const heading = document.querySelector('main h1, h1')
	if (!heading) return
	heading.tabIndex = -1
	heading.focus({ preventScroll: true })
	const title = heading.textContent.replace(/\s+/g, ' ').trim()
	document.title = title ? `${title} · RepuestosPro` : 'RepuestosPro'
}
