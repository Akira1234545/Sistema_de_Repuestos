import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authState.js'
import { obtenerFavoritosUsuario, quitarFavorito } from '../services/favoritoService.js'
import './Promociones.css'

const itemIdField = { tienda: 'tienda_id', solicitud: 'solicitud_id', promocion: 'promocion_id' }
const itemType = { tienda: 'Tiendas', solicitud: 'Solicitudes', promocion: 'Promociones' }
function Favoritos() {
	const { user, role } = useAuth()
	const [items, setItems] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [removing, setRemoving] = useState('')
	useEffect(() => {
		let active = true
		obtenerFavoritosUsuario(user.id).then((data) => { if (active) setItems(data) }).catch((cause) => { if (active) setError(`No se pudieron cargar tus favoritos: ${cause.message}`) }).finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [user.id])
	async function remove(item) {
		setRemoving(item.id)
		try {
			await quitarFavorito(item.type, item[itemIdField[item.type]], user.id)
			setItems((current) => current.filter((entry) => entry.id !== item.id))
		} catch (cause) { setError(`No se pudo quitar el favorito: ${cause.message}`) }
		finally { setRemoving('') }
	}
	return <main className="promo-page"><header className="promo-page-heading"><div><p className="promo-eyebrow">RepuestosPro / Guardados</p><h1>Mis favoritos</h1><p>Tiendas, solicitudes y promociones que guardaste.</p><Link to={role === 'tienda' ? '/tienda' : '/cliente'}>Volver al panel</Link></div></header>
		{loading && <p className="promo-state">Cargando favoritos…</p>}{error && <p className="promo-error" role="alert">{error}</p>}{!loading && !items.length && <div className="promo-state"><h2>No guardaste elementos todavía</h2><p>Usa el botón de favorito cuando consultes una tienda seleccionada, una solicitud o una promoción.</p><Link to="/promociones">Explorar promociones</Link></div>}
		{!loading && items.length > 0 && <div className="favorites-groups">{Object.keys(itemType).map((type) => {
			const group = items.filter((item) => item.type === type)
			if (!group.length) return null
			return <section className="favorites-group" key={type}><h2>{itemType[type]}</h2><div className="favorites-list">{group.map((favorite) => <article className="favorite-card" key={favorite.id}><div><p className="promo-category">{type}</p><h3>{favorite.item?.nombre || favorite.item?.titulo || 'Elemento no disponible'}</h3>{type === 'tienda' && favorite.item && <p>{favorite.item.direccion || 'Dirección no registrada'}{favorite.item.telefono ? ` · ${favorite.item.telefono}` : ''}</p>}{type === 'solicitud' && favorite.item && <p>Estado: {favorite.item.estado.replaceAll('_', ' ')}</p>}{type === 'promocion' && favorite.item && <p>Precio de oferta: {new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(favorite.item.precio_oferta))}</p>}</div><div className="favorite-actions">{type === 'promocion' && favorite.item && <Link to={`/promociones/${favorite.item.id}`}>Ver promoción</Link>}{type === 'solicitud' && favorite.item && <Link to={role === 'tienda' ? `/tienda/solicitudes/${favorite.item.id}` : `/cliente/solicitudes/${favorite.item.id}/propuestas`}>Ver solicitud</Link>}<button className="promo-secondary" type="button" onClick={() => remove(favorite)} disabled={removing === favorite.id}>{removing === favorite.id ? 'Quitando…' : 'Quitar'}</button></div></article>)}</div></section>
		})}</div>}
	</main>
}
export default Favoritos
