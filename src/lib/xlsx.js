// Generador mínimo de .xlsx (sesión 8). Sin dependencias: un ZIP sin compresión con el XML de
// Office Open. Lo abren Excel, LibreOffice, Google Sheets y Numbers.
//
// Entrada: { title, meta: [texto], sections: [{ title, columns: [{ label, numeric }], rows: [[...]] }] }
// Salida: Blob listo para descargar.
//
// Los colores salen de los tokens de src/styles/tokens.css (se leen del documento en tiempo de
// ejecución); si no se pueden leer, la hoja usa los colores por defecto de la aplicación de hojas.

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// ---------- ZIP (método «store») ----------

const CRC_TABLE = (() => {
	const table = new Uint32Array(256)
	for (let n = 0; n < 256; n += 1) {
		let c = n
		for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
		table[n] = c >>> 0
	}
	return table
})()

export function crc32(bytes) {
	let crc = 0xffffffff
	for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
	return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(date) {
	const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
	const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
	return { time, day }
}

export function zipStore(files, date = new Date()) {
	const encoder = new TextEncoder()
	const { time, day } = dosDateTime(date)
	const chunks = []
	const central = []
	let offset = 0

	for (const file of files) {
		const name = encoder.encode(file.name)
		const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data
		const crc = crc32(data)
		const local = new DataView(new ArrayBuffer(30))
		local.setUint32(0, 0x04034b50, true)
		local.setUint16(4, 20, true)
		local.setUint16(6, 0x0800, true) // nombres en UTF-8
		local.setUint16(8, 0, true)
		local.setUint16(10, time, true)
		local.setUint16(12, day, true)
		local.setUint32(14, crc, true)
		local.setUint32(18, data.length, true)
		local.setUint32(22, data.length, true)
		local.setUint16(26, name.length, true)
		local.setUint16(28, 0, true)
		chunks.push(new Uint8Array(local.buffer), name, data)

		const entry = new DataView(new ArrayBuffer(46))
		entry.setUint32(0, 0x02014b50, true)
		entry.setUint16(4, 20, true)
		entry.setUint16(6, 20, true)
		entry.setUint16(8, 0x0800, true)
		entry.setUint16(10, 0, true)
		entry.setUint16(12, time, true)
		entry.setUint16(14, day, true)
		entry.setUint32(16, crc, true)
		entry.setUint32(20, data.length, true)
		entry.setUint32(24, data.length, true)
		entry.setUint16(28, name.length, true)
		entry.setUint32(42, offset, true)
		central.push(new Uint8Array(entry.buffer), name)

		offset += 30 + name.length + data.length
	}

	const centralSize = central.reduce((sum, part) => sum + part.length, 0)
	const end = new DataView(new ArrayBuffer(22))
	end.setUint32(0, 0x06054b50, true)
	end.setUint16(8, files.length, true)
	end.setUint16(10, files.length, true)
	end.setUint32(12, centralSize, true)
	end.setUint32(16, offset, true)

	const parts = [...chunks, ...central, new Uint8Array(end.buffer)]
	const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
	let position = 0
	for (const part of parts) { out.set(part, position); position += part.length }
	return out
}

// ---------- Hoja de cálculo ----------

function escapeXml(value) {
	return String(value)
		// Quita caracteres de control que el XML no admite.
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
		.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function columnName(index) {
	let name = ''
	let n = index + 1
	while (n > 0) { const r = (n - 1) % 26; name = String.fromCharCode(65 + r) + name; n = Math.floor((n - 1) / 26) }
	return name
}

// Lee un token de color («#RRGGBB») y lo devuelve como ARGB de Office, o null.
function tokenColor(name) {
	try {
		const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
		const match = /^#([0-9a-f]{6})$/i.exec(value)
		return match ? `FF${match[1].toUpperCase()}` : null
	} catch {
		return null
	}
}

function readPalette() {
	return {
		accent: tokenColor('--accent'),
		accentInk: tokenColor('--white'),
		text: tokenColor('--gray-900'),
		muted: tokenColor('--text-muted'),
		header: tokenColor('--gray-100'),
		band: tokenColor('--gray-50'),
		line: tokenColor('--gray-200'),
		lineStrong: tokenColor('--gray-300'),
	}
}

const color = (argb) => (argb ? `<color rgb="${argb}"/>` : '')
const fill = (argb) => (argb
	? `<fill><patternFill patternType="solid"><fgColor rgb="${argb}"/><bgColor indexed="64"/></patternFill></fill>`
	: '<fill><patternFill patternType="none"/></fill>')
const bottom = (argb) => `<border><left/><right/><top/><bottom style="thin">${color(argb)}</bottom><diagonal/></border>`

// Índices de estilo (cellXfs).
const S = { title: 1, meta: 2, section: 3, header: 4, headerNum: 5, text: 6, num: 7, textBand: 8, numBand: 9 }

function stylesXml(p) {
	const fonts = [
		`<font><sz val="11"/>${color(p.text)}<name val="Calibri"/><family val="2"/></font>`,
		`<font><b/><sz val="16"/>${color(p.accent)}<name val="Calibri"/><family val="2"/></font>`,
		`<font><sz val="10"/>${color(p.muted)}<name val="Calibri"/><family val="2"/></font>`,
		`<font><b/><sz val="12"/>${color(p.accentInk)}<name val="Calibri"/><family val="2"/></font>`,
		`<font><b/><sz val="11"/>${color(p.text)}<name val="Calibri"/><family val="2"/></font>`,
	]
	const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>', fill(p.accent), fill(p.header), fill(p.band)]
	const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>', bottom(p.line), bottom(p.lineStrong)]
	const left = '<alignment vertical="center" indent="1" wrapText="1"/>'
	const right = '<alignment horizontal="right" vertical="center" indent="1"/>'
	const xfs = [
		'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
		'<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>',
		'<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf>',
		`<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">${left}</xf>`,
		`<xf numFmtId="0" fontId="4" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${left}</xf>`,
		`<xf numFmtId="0" fontId="4" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${right}</xf>`,
		`<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">${left}</xf>`,
		`<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1">${right}</xf>`,
		`<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1">${left}</xf>`,
		`<xf numFmtId="3" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1">${right}</xf>`,
	]
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="${fonts.length}">${fonts.join('')}</fonts>
<fills count="${fills.length}">${fills.join('')}</fills>
<borders count="${borders.length}">${borders.join('')}</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`
}

function cellXml(ref, value, style) {
	if (value === null || value === undefined || value === '') return `<c r="${ref}" s="${style}"/>`
	if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`
	return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

// Ancho de columna en caracteres a partir del texto más largo de cada columna de las tablas.
function columnWidths(doc, count) {
	const widths = Array.from({ length: count }, (_, index) => (index === 0 ? 24 : 12))
	for (const section of doc.sections) {
		const rows = [section.columns.map((column) => column.label), ...section.rows]
		for (const row of rows) {
			row.forEach((value, index) => {
				const text = typeof value === 'number' ? value.toLocaleString('es-BO') : String(value ?? '')
				widths[index] = Math.max(widths[index], Math.min(index === 0 ? 48 : 28, text.length + 4))
			})
		}
	}
	return widths
}

export function buildWorkbook(doc) {
	const palette = readPalette()
	const count = Math.max(2, ...doc.sections.map((section) => section.columns.length))
	const last = columnName(count - 1)
	const widths = columnWidths(doc, count)
	const rows = []
	const merges = []
	let r = 0
	const row = (cells, height) => {
		r += 1
		rows.push(`<row r="${r}" ht="${height}" customHeight="1">${cells.join('')}</row>`)
	}
	const fullWidth = (text, style, height) => {
		row([cellXml(`A${r + 1}`, text, style), ...Array.from({ length: count - 1 }, (_, i) => cellXml(`${columnName(i + 1)}${r + 1}`, '', style))], height)
		merges.push(`A${r}:${last}${r}`)
	}

	fullWidth(doc.title, S.title, 30)
	for (const line of doc.meta) fullWidth(line, S.meta, 18)

	for (const section of doc.sections) {
		row([], 12)
		fullWidth(section.title, S.section, 24)
		row(section.columns.map((column, i) => cellXml(`${columnName(i)}${r + 1}`, column.label, column.numeric ? S.headerNum : S.header)), 22)
		section.rows.forEach((values, index) => {
			const band = index % 2 === 1
			row(section.columns.map((column, i) => {
				const numeric = column.numeric && typeof values[i] === 'number'
				const style = numeric ? (band ? S.numBand : S.num) : (band ? S.textBand : S.text)
				return cellXml(`${columnName(i)}${r + 1}`, values[i], style)
			}), 20)
		})
		if (!section.rows.length) fullWidth(section.empty || 'Sin registros en este periodo.', S.meta, 20)
	}

	const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="20"/>
<cols>${widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows.join('')}</sheetData>
${merges.length ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>` : ''}
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>
</worksheet>`

	const sheetName = escapeXml((doc.sheetName || 'Reporte').slice(0, 31))
	const files = [
		{ name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>` },
		{ name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },
		{ name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets>
</workbook>` },
		{ name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },
		{ name: 'xl/styles.xml', data: stylesXml(palette) },
		{ name: 'xl/worksheets/sheet1.xml', data: sheet },
	]
	return new Blob([zipStore(files)], { type: XLSX_MIME })
}

// CSV con «;» (Excel en español) y BOM para que respete tildes. Mismas secciones que el .xlsx.
export function buildCsv(doc) {
	const cell = (value) => {
		if (typeof value === 'number' && Number.isFinite(value)) return String(value)
		let text = String(value ?? '')
		// Evita que Excel interprete el texto como fórmula.
		if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`
		return /[;"\r\n]/.test(text) || text !== text.trim() ? `"${text.replaceAll('"', '""')}"` : text
	}
	const lines = [[doc.title], ...doc.meta.map((line) => [line])]
	for (const section of doc.sections) {
		lines.push([], [section.title.toLocaleUpperCase('es')], section.columns.map((column) => column.label), ...section.rows)
		if (!section.rows.length) lines.push([section.empty || 'Sin registros en este periodo.'])
	}
	const bom = String.fromCharCode(0xfeff)
	return new Blob([`${bom}${lines.map((line) => line.map(cell).join(';')).join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' })
}

export function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement('a')
	anchor.href = url
	anchor.download = filename
	document.body.append(anchor)
	anchor.click()
	anchor.remove()
	window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
