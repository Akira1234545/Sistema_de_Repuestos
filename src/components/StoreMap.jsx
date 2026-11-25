import { useState } from 'react'
import { validCoordinates } from '../lib/geo.js'

// Mapa de OpenStreetMap para tiendas (sesión 8). El mapa embebido tarda unos segundos en
// dibujar las calles; mientras tanto se ve un fondo con la dirección en lugar de un recuadro
// blanco. Zoom a nivel de calle y enlace «Cómo llegar».
export default function StoreMap({ name, address, lat, lng, span = 0.006, compact = false }) {
	const [loaded, setLoaded] = useState(false)
	if (!validCoordinates(lat, lng)) {
		return <div className="store-map is-empty" role="note">
			<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M12 21s-6-5.4-6-11a6 6 0 0 1 12 0c0 5.6-6 11-6 11Z" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
			<p><strong>{address || 'Sin dirección registrada'}</strong><span>La tienda todavía no marcó su ubicación en el mapa.</span></p>
		</div>
	}
	const latitude = Number(lat)
	const longitude = Number(lng)
	const params = new URLSearchParams({
		bbox: [longitude - span, latitude - span * .6, longitude + span, latitude + span * .6].map((value) => value.toFixed(6)).join(','),
		layer: 'mapnik',
		marker: `${latitude.toFixed(6)},${longitude.toFixed(6)}`,
	})
	const openUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`
	const directionsUrl = `https://www.openstreetmap.org/directions?route=%3B${latitude}%2C${longitude}`
	return <figure className={`store-map${compact ? ' is-compact' : ''}`}>
		<div className="store-map-frame">
			{!loaded && <div className="store-map-placeholder" aria-hidden="true">
				<span className="store-map-pin" />
				<span>Cargando mapa de {name || 'la tienda'}…</span>
			</div>}
			<iframe title={`Mapa de ${name || 'la tienda'}`} src={`https://www.openstreetmap.org/export/embed.html?${params}`} loading="lazy"
				referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setLoaded(true)} />
		</div>
		<figcaption>
			<span className="store-map-address"><strong>{name}</strong>{address && <span>{address}</span>}</span>
			<span className="store-map-links">
				<a href={directionsUrl} target="_blank" rel="noreferrer">Cómo llegar ↗</a>
				<a href={openUrl} target="_blank" rel="noreferrer">Ver mapa grande ↗</a>
			</span>
			<small>© OpenStreetMap contributors</small>
		</figcaption>
	</figure>
}
