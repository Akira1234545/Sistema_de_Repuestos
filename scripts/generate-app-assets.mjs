// Genera los PNG de Android (iconos y splash) y las fuentes de assets/ a partir del logo DriveFix
// de branding/drivefix/. Los SVG se leen sin los metadatos C2PA.
// Uso: npm run android:assets
//
// Los iconos adaptativos (Android 8+) y el icono temático (Android 13+) son vectores en
// android/app/src/main/res/drawable*/ y mipmap-anydpi-v26/: este script no los toca.
// Los PNG que escribe son para Android 7 (iconos sin capas), el splash anterior a Android 12
// y las imágenes de origen para Google Play.
import sharp from 'sharp'
import { mkdir, readFile } from 'node:fs/promises'

const BRAND = 'branding/drivefix'
const RES = 'android/app/src/main/res'
const INK = '#0E1726'

// Quita el bloque <metadata> (manifiesto C2PA) y su espacio de nombres.
const clean = (svg) => svg
	.replace(/<metadata>[\s\S]*?<\/metadata>/g, '')
	.replace(/\s+xmlns:c2pa="[^"]*"/g, '')
const load = async (file) => clean(await readFile(`${BRAND}/${file}`, 'utf8'))

const isotipo = await load('drivefix-isotipo.svg') // cuadro de tinta redondeado (64×64)
const icon1024 = await load('android/icono-1024.svg') // cuadro de tinta sin redondear
const foreground = await load('android/ic_launcher_foreground.svg') // capa frontal de 108×108
const splash = await load('android/splash-2732.svg') // chevrones centrados sobre tinta

// Icono redondo: círculo de tinta y los chevrones de la capa frontal (ya dentro de la zona segura).
const chevrons = foreground.match(/<g[\s\S]*<\/g>/)[0]
const round = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><circle cx="54" cy="54" r="54" fill="${INK}"/>${chevrons}</svg>`
const background = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><rect width="108" height="108" fill="${INK}"/></svg>`

const viewBoxWidth = (svg) => Number(svg.match(/viewBox="0 0 (\d+(?:\.\d+)?)/)[1])
// Rasteriza a `size` px: density escala el ancho del viewBox del SVG.
const raster = (svg, size) => sharp(Buffer.from(svg), { density: 72 * size / viewBoxWidth(svg) }).resize(size, size)
const write = async (pipeline, file) => {
	await mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true })
	await pipeline.png().toFile(file)
}

// Fuentes (Google Play y capacitor-assets, si se vuelve a usar).
await write(raster(icon1024, 1024), 'assets/icon-only.png')
await write(raster(foreground, 1024), 'assets/icon-foreground.png')
await write(raster(background, 1024), 'assets/icon-background.png')
await write(raster(splash, 2732), 'assets/splash.png')
await write(raster(splash, 2732), 'assets/splash-dark.png')

// Iconos por densidad (48 dp).
const densities = { ldpi: 36, mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
for (const [density, size] of Object.entries(densities)) {
	const dir = `${RES}/mipmap-${density}`
	await write(raster(isotipo, size), `${dir}/ic_launcher.png`)
	await write(raster(round, size), `${dir}/ic_launcher_round.png`)
	await write(raster(foreground, size), `${dir}/ic_launcher_foreground.png`)
	await write(raster(background, size), `${dir}/ic_launcher_background.png`)
}

// Splash anterior a Android 12 y del plugin SplashScreen: el lienzo de 2732 recortado al centro.
const portrait = { ldpi: [240, 320], mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] }
const splashPng = (width, height) => sharp(Buffer.from(splash), { density: 72 * Math.max(width, height) / viewBoxWidth(splash) })
	.resize(width, height, { fit: 'cover', position: 'centre' })
const splashTargets = [['drawable', 320, 480], ['drawable-night', 320, 240]]
for (const [density, [w, h]] of Object.entries(portrait)) {
	for (const night of ['', '-night']) {
		splashTargets.push([`drawable-port${night}-${density}`, w, h])
		splashTargets.push([`drawable-land${night}-${density}`, h, w])
	}
}
for (const [dir, width, height] of splashTargets) await write(splashPng(width, height), `${RES}/${dir}/splash.png`)

console.log(`DriveFix: ${5 + Object.keys(densities).length * 4 + splashTargets.length} PNG escritos en assets/ y ${RES}/`)
