import { App as CapacitorApp } from '@capacitor/app'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { isNativeApp } from './platform.js'

// Actualizaciones a distancia (OTA) de la app Android.
// GitHub Actions compila la web en cada cambio y publica un .zip y un manifiesto en la rama «ota»
// del repositorio (.github/workflows/ota-publicar.yml). La app lee el manifiesto al abrirse y al
// volver a primer plano, descarga el .zip si la versión cambió y lo aplica en el siguiente arranque.
// Solo cambia la parte web (React, estilos, imágenes); el código nativo necesita un APK nuevo.
export const OTA_MANIFEST_URL = 'https://raw.githubusercontent.com/Akira1234545/sistema_de_repuestos/ota/android/latest.json'
/* global __APP_VERSION__ -- la define vite.config.js al compilar */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'

let checking = null

async function nativeBuild() {
	try { return Number((await CapacitorApp.getInfo()).build) || 0 } catch { return 0 }
}

async function readManifest() {
	// raw.githubusercontent.com guarda en caché unos minutos; el parámetro evita leer una copia vieja.
	const response = await fetch(`${OTA_MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' })
	if (!response.ok) throw new Error(`Manifiesto OTA: HTTP ${response.status}`)
	const manifest = await response.json()
	if (!manifest?.version || !manifest?.url || !manifest?.checksum) throw new Error('Manifiesto OTA incompleto')
	if (!String(manifest.url).startsWith('https://')) throw new Error('El paquete OTA debe servirse por https')
	return manifest
}

async function checkForUpdate() {
	const manifest = await readManifest()
	if (manifest.version === APP_VERSION) return
	// Un paquete compilado para un APK más nuevo puede usar plugins que esta app no trae.
	if (Number(manifest.minBuild || 0) > await nativeBuild()) {
		console.info(`[OTA] ${manifest.version} requiere un APK más nuevo (build ${manifest.minBuild}).`)
		return
	}
	const { bundles } = await CapacitorUpdater.list()
	const ready = bundles.find((bundle) => bundle.version === manifest.version && bundle.status !== 'error')
	const bundle = ready || await CapacitorUpdater.download({ url: manifest.url, version: manifest.version, checksum: manifest.checksum })
	// Se aplica al cerrar o reabrir la app, nunca en medio de lo que el usuario está haciendo.
	await CapacitorUpdater.next({ id: bundle.id })
	console.info(`[OTA] ${manifest.version} descargada; se aplicará al reabrir la app.`)
}

function scheduleCheck() {
	if (checking) return checking
	checking = checkForUpdate()
		.catch((error) => console.warn('[OTA] No se pudo comprobar la actualización:', error?.message || error))
		.finally(() => { checking = null })
	return checking
}

export function startLiveUpdates() {
	if (!isNativeApp) return
	// Sin esta confirmación el plugin vuelve a la versión anterior a los pocos segundos.
	void CapacitorUpdater.notifyAppReady().catch(() => {})
	void scheduleCheck()
	void CapacitorApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void scheduleCheck() }).catch(() => {})
}
