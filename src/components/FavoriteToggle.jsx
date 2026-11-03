import { useEffect, useState } from 'react'
import { useAuth } from '../context/authState.js'
import Icon from './Icon.jsx'
import { obtenerFavorito, agregarFavorito, quitarFavorito } from '../services/favoritoService.js'

// iconOnly renders a compact heart button for dense lists; the accessible name keeps the full label.
function FavoriteToggle({ type, itemId, label = 'Favorito', iconOnly = false }) {
	const { user } = useAuth()
	const [saved, setSaved] = useState(false)
	const [busy, setBusy] = useState(false)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	useEffect(() => {
		let active = true
		obtenerFavorito(type, itemId, user.id).then((exists) => { if (active) setSaved(exists) })
			.catch((loadError) => { if (active) setError(loadError.message) })
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [type, itemId, user.id])
	async function toggle() {
		setBusy(true); setError('')
		try {
			if (saved) await quitarFavorito(type, itemId, user.id)
			else await agregarFavorito(type, itemId, user.id)
			setSaved(!saved)
		} catch (toggleError) { setError(toggleError.message) }
		finally { setBusy(false) }
	}
	if (iconOnly) return <button className={`icon-action${saved ? ' is-saved' : ''}`} type="button" onClick={toggle} disabled={loading || busy || !user?.id} aria-pressed={saved} aria-label={saved ? `Quitar ${label} de favoritos` : `Guardar ${label}`} title={error || (saved ? 'Guardado' : 'Guardar')}><Icon name="heart" size={18} filled={saved} /></button>
	return <span className="favorite-control"><button className={`favorite-toggle${saved ? ' is-saved' : ''}`} type="button" onClick={toggle} disabled={loading || busy || !user?.id} aria-pressed={saved}>{busy ? 'Guardando…' : saved ? '♥ Guardado' : `♡ Guardar ${label}`}</button>{error && <span className="favorite-error" role="alert">{error}</span>}</span>
}
export default FavoriteToggle
