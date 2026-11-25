// Sesión 8: el reporte de admin se exporta como .xlsx con formato y como .csv solo con datos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crc32 as zlibCrc32 } from 'node:zlib'
import { buildCsv, buildWorkbook, crc32 } from '../src/lib/xlsx.js'

const doc = {
	title: 'DriveFix · Reporte de actividad',
	meta: ['Periodo: 1 nov 2026 – 24 nov 2026'],
	sections: [
		{ title: 'Resumen', columns: [{ label: 'Indicador' }, { label: 'Total', numeric: true }], rows: [['Usuarios', 6], ['=HYPERLINK("x")', 1234]] },
		{ title: 'Vacía', columns: [{ label: 'Categoría' }], rows: [], empty: 'Nada en este periodo.' },
	],
}

// Lee el directorio central del ZIP y devuelve { nombre: texto }.
function unzipStore(bytes) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const end = bytes.length - 22
	assert.equal(view.getUint32(end, true), 0x06054b50)
	const count = view.getUint16(end + 10, true)
	let at = view.getUint32(end + 16, true)
	const files = {}
	for (let i = 0; i < count; i += 1) {
		assert.equal(view.getUint32(at, true), 0x02014b50)
		const crc = view.getUint32(at + 16, true)
		const size = view.getUint32(at + 20, true)
		const nameLength = view.getUint16(at + 28, true)
		const offset = view.getUint32(at + 42, true)
		const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength))
		const localName = view.getUint16(offset + 26, true)
		const data = bytes.subarray(offset + 30 + localName, offset + 30 + localName + size)
		assert.equal(crc32(data), crc, `CRC de ${name}`)
		files[name] = new TextDecoder().decode(data)
		at += 46 + nameLength
	}
	return files
}

test('crc32 coincide con zlib', () => {
	const sample = new TextEncoder().encode('DriveFix · áéí 123')
	assert.equal(crc32(sample), zlibCrc32(sample))
})

test('el .xlsx es un ZIP válido con las partes de Office y sin XML roto', async () => {
	const files = unzipStore(new Uint8Array(await buildWorkbook(doc).arrayBuffer()))
	assert.deepEqual(Object.keys(files).sort(), ['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'])
	const sheet = files['xl/worksheets/sheet1.xml']
	assert.match(sheet, /<col min="1" max="1" width="\d+" customWidth="1"\/>/)
	assert.match(sheet, /<mergeCell ref="A1:B1"\/>/)
	assert.match(sheet, /<v>1234<\/v>/, 'los números van como números')
	assert.match(sheet, /=HYPERLINK\(&quot;x&quot;\)/, 'el texto se escapa y queda como texto, no como fórmula')
	assert.doesNotMatch(sheet, /<f>/)
	assert.match(sheet, /Nada en este periodo\./)
})

test('el .csv usa ; y BOM, deja números sin comillas y neutraliza fórmulas', async () => {
	const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await buildCsv(doc).arrayBuffer())
	assert.equal(text.charCodeAt(0), 0xfeff)
	const lines = text.slice(1).split('\r\n')
	assert.ok(lines.includes('Indicador;Total'))
	assert.ok(lines.includes('Usuarios;6'))
	assert.ok(lines.includes(`"'=HYPERLINK(""x"")";1234`))
	assert.ok(lines.includes('Nada en este periodo.'))
})

test('la versión imprimible (PDF) escapa el texto y repite encabezados de tabla', async () => {
	const { buildPrintHtml } = await import('../src/lib/reportPrint.js')
	const html = buildPrintHtml(doc, 'drivefix_reporte_prueba')
	assert.match(html, /<title>drivefix_reporte_prueba<\/title>/)
	assert.match(html, /thead \{ display: table-header-group; \}/)
	assert.match(html, /<td class="num">1234<\/td>|<td class="num">1\.234<\/td>/)
	assert.match(html, /=HYPERLINK\(&quot;x&quot;\)/)
	assert.doesNotMatch(html, /<script/i)
	assert.match(html, /Nada en este periodo\./)
})
