import { useEffect, useRef } from 'react'
import Icon from '../Icon.jsx'
import { useLayer } from '../../lib/layers.js'

// E31: visor de fotos con foco gestionado. Al abrir, el foco va a «Cerrar»; Escape, el botón atrás
// de Android, un toque fuera de la foto o «Cerrar» lo cierran y el foco vuelve a la miniatura.
export default function PhotoViewer({ src, alt, onClose }) {
	const closeRef = useRef(null)
	useLayer(Boolean(src), onClose)
	useEffect(() => { if (src) closeRef.current?.focus({ preventScroll: true }) }, [src])
	if (!src) return null
	return <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={onClose}
		onKeyDown={(event) => { if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus() } }}>
		<img src={src} alt={alt} referrerPolicy="no-referrer" onClick={(event) => event.stopPropagation()} />
		<button ref={closeRef} type="button" className="icon-action" aria-label="Cerrar foto ampliada" onClick={onClose}><Icon name="x" size={18} /></button>
	</div>
}
