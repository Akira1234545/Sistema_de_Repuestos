// Moves focus to the page heading and names the browser tab after it, so screen
// reader and keyboard users land on the new content after client-side navigation.
// Returns false when the page has not rendered its heading yet (still loading data).
export function announceRoute(root = document) {
	const heading = root.querySelector('h1')
	if (!heading) return false
	heading.tabIndex = -1
	heading.focus({ preventScroll: true })
	const title = heading.textContent.replace(/\s+/g, ' ').trim()
	document.title = title ? `${title} · RepuestosPro` : 'RepuestosPro'
	return true
}
