// Sesión 8: versión imprimible del reporte de admin («Imprimir / PDF»).
// Usa el mismo modelo que el .xlsx ({ title, meta, sections }) y lo imprime desde un iframe oculto,
// así no sale el panel (menús, botones, gráficos) y el PDF queda con tablas limpias.
// Los colores se leen de los tokens de src/styles/tokens.css en tiempo de ejecución.

const TOKENS = {
	'--accent': '--p-accent',
	'--white': '--p-accent-ink',
	'--gray-900': '--p-text',
	'--text-muted': '--p-muted',
	'--gray-100': '--p-header',
	'--gray-50': '--p-band',
	'--gray-200': '--p-line',
	'--gray-300': '--p-line-strong',
}

function escapeHtml(value) {
	return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function tokenDeclarations() {
	try {
		const styles = getComputedStyle(document.documentElement)
		const font = getComputedStyle(document.body).fontFamily
		const lines = Object.entries(TOKENS)
			.map(([token, local]) => [local, styles.getPropertyValue(token).trim()])
			.filter(([, value]) => value)
			.map(([local, value]) => `${local}: ${value};`)
		if (font) lines.push(`--p-font: ${font};`)
		return lines.join(' ')
	} catch {
		return ''
	}
}

const numberFormatter = new Intl.NumberFormat('es-BO')

function cell(value, numeric) {
	const text = numeric && typeof value === 'number' ? numberFormatter.format(value) : value
	return `<td${numeric ? ' class="num"' : ''}>${escapeHtml(text)}</td>`
}

export function buildPrintHtml(doc, fileTitle) {
	const sections = doc.sections.map((section) => {
		const head = section.columns.map((column) => `<th${column.numeric ? ' class="num"' : ''} scope="col">${escapeHtml(column.label)}</th>`).join('')
		const body = section.rows.length
			? section.rows.map((row) => `<tr>${section.columns.map((column, i) => cell(row[i], column.numeric)).join('')}</tr>`).join('')
			: `<tr><td class="empty" colspan="${section.columns.length}">${escapeHtml(section.empty || 'Sin registros en este periodo.')}</td></tr>`
		return `<section><h2>${escapeHtml(section.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`
	}).join('')

	return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(fileTitle)}</title>
<style>
:root { ${tokenDeclarations()} }
@page { size: A4; margin: 14mm 12mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: var(--p-font, system-ui, sans-serif); font-size: 10pt; line-height: 1.4; color: var(--p-text); }
header { margin-bottom: 14pt; padding-bottom: 10pt; border-bottom: 2pt solid var(--p-accent); }
h1 { margin: 0 0 4pt; font-size: 18pt; line-height: 1.2; color: var(--p-accent); }
header p { margin: 0; font-size: 9pt; color: var(--p-muted); }
section { margin-top: 14pt; }
h2 { margin: 0; padding: 5pt 8pt; font-size: 11pt; color: var(--p-accent-ink); background: var(--p-accent); break-after: avoid; page-break-after: avoid; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th, td { padding: 4pt 8pt; text-align: left; vertical-align: top; border-bottom: 0.75pt solid var(--p-line); }
th { font-weight: 700; background: var(--p-header); border-bottom: 1pt solid var(--p-line-strong); }
tbody tr:nth-child(even) td { background: var(--p-band); }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
td.empty { color: var(--p-muted); font-style: italic; }
footer { margin-top: 16pt; font-size: 8pt; color: var(--p-muted); }
</style></head>
<body>
<header><h1>${escapeHtml(doc.title)}</h1>${doc.meta.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</header>
${sections}
<footer>Datos reales de la plataforma en el momento de generar el reporte.</footer>
</body></html>`
}

// Abre el diálogo de impresión del navegador («Guardar como PDF») sin salir del panel.
export function printReport(html) {
	const frame = document.createElement('iframe')
	frame.setAttribute('aria-hidden', 'true')
	frame.tabIndex = -1
	frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
	let removed = false
	const remove = () => { if (!removed) { removed = true; frame.remove() } }
	frame.addEventListener('load', () => {
		const view = frame.contentWindow
		if (!view) { remove(); return }
		view.addEventListener('afterprint', () => window.setTimeout(remove, 0))
		view.focus()
		view.print()
		// Por si el navegador no avisa con afterprint.
		window.setTimeout(remove, 60000)
	}, { once: true })
	frame.srcdoc = html
	document.body.append(frame)
}
