// Renders the RepuestosPro mark into the source images @capacitor/assets expects.
// Usage: node scripts/generate-app-assets.mjs && npx capacitor-assets generate --android
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const BG = '#0b0d11'
const letter = 'M20 48V16h14.5c7 0 11.5 4 11.5 10 0 4.6-2.6 7.9-6.8 9.2L47 48h-8.6l-7.2-12H28v12zm8-18.6h6c3 0 4.6-1.4 4.6-3.6S37 23 34 23h-6z'
const gradient = '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset=".6" stop-color="#f5b13d"/><stop offset="1" stop-color="#c9861b"/></linearGradient></defs>'

// Full icon: amber tile with the R, used for legacy launchers.
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${gradient}<rect width="64" height="64" rx="15" fill="url(#g)"/><path d="${letter}" fill="#1a1306"/></svg>`
// Adaptive icon layers: the launcher crops to its own shape, so keep the R inside the safe zone.
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><g transform="translate(26 26)"><path d="${letter}" fill="#1a1306"/></g></svg>`
const background = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${gradient}<rect width="108" height="108" fill="url(#g)"/></svg>`
// Splash: mark and wordmark centred on the app background.
const splash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">${gradient}<rect width="2732" height="2732" fill="${BG}"/>
  <g transform="translate(1166 1066) scale(6.25)"><rect width="64" height="64" rx="15" fill="url(#g)"/><path d="${letter}" fill="#1a1306"/></g>
  <text x="1366" y="1590" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="120" font-weight="800" fill="#eef1f5">Repuestos<tspan fill="#f5b13d">Pro</tspan></text></svg>`

await mkdir('assets', { recursive: true })
// Rasterise at the target size: density scales the SVG's own viewBox width to `size` pixels.
const render = (svg, viewBox, size, file) => sharp(Buffer.from(svg), { density: 72 * size / viewBox }).resize(size, size).png().toFile(`assets/${file}`)
await render(icon, 64, 1024, 'icon-only.png')
await render(foreground, 108, 1024, 'icon-foreground.png')
await render(background, 108, 1024, 'icon-background.png')
await render(splash, 2732, 2732, 'splash.png')
await render(splash, 2732, 2732, 'splash-dark.png')
console.log('Assets written to assets/')
