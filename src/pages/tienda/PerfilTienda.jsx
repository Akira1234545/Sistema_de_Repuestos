import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import { obtenerTiendaUsuario } from '../../services/tiendaService.js'
import './PerfilTienda.css'

function PerfilTienda() {
	const { user } = useAuth()
	const [store, setStore] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		async function loadStore() {
			try {
				const data = await obtenerTiendaUsuario(user.id)
				if (active) setStore(data)
			} catch (loadError) {
				if (active) setError(`No se pudo cargar tu tienda: ${loadError.message}`)
			} finally {
				if (active) setLoading(false)
			}
		}
		if (user?.id) loadStore()
		return () => { active = false }
	}, [user?.id])

	if (loading) return <section className="store-profile-page"><p className="profile-state">Cargando información de tu tienda...</p></section>
	if (error) return <section className="store-profile-page"><p className="profile-state profile-state-error" role="alert">{error}</p></section>
	if (!store) return <section className="store-profile-page"><div className="profile-empty"><span className="profile-eyebrow">Mi tienda</span><h1>Tu tienda todavía no está registrada.</h1><p>Completa la información para comenzar a mostrar tu negocio.</p><Link className="profile-primary-button" to="/tienda/editar">Crear mi tienda <span>↗</span></Link></div></section>

	const latitude = Number(store.latitud)
	const longitude = Number(store.longitud)
	const hasLocation = store.latitud !== null && store.latitud !== '' && store.longitud !== null && store.longitud !== ''
		&& Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
	const mapParams = new URLSearchParams({ bbox: `${longitude - 0.015},${latitude - 0.015},${longitude + 0.015},${latitude + 0.015}`, layer: 'mapnik', marker: `${latitude},${longitude}` })
	const mapUrl = hasLocation ? `https://www.openstreetmap.org/export/embed.html?${mapParams.toString()}` : null

	return (
		<section className="store-profile-page">
			<header className="profile-hero">
				<div>
					<span className="profile-eyebrow">Panel de tienda / Mi tienda</span>
					<h1>{store.nombre}</h1>
					<p>Repuestos y accesorios para vehículos</p>
				</div>
				<Link className="profile-primary-button" to="/tienda/editar">Editar tienda <span>↗</span></Link>
			</header>

			<div className="profile-status-row">
				<span className="profile-status-dot" />
				<strong>Estado de la tienda</strong>
				<span className="profile-status-value">{store.estado || 'No registrado'}</span>
			</div>

			<section className="profile-gallery-section">
				<div className="profile-section-heading"><div><span className="profile-eyebrow">Presentación</span><h2>Fotografías de la tienda</h2></div><span>{store.fotografias?.length || 0} fotos</span></div>
				{store.fotografias?.length > 0 ? <div className="profile-gallery">{store.fotografias.map((photo) => <a className="profile-photo" href={photo} target="_blank" rel="noreferrer" key={photo}><img src={photo} alt={`Fotografía de ${store.nombre}`} /><span>Ver imagen ↗</span></a>)}</div> : <p className="profile-muted-card">Esta tienda todavía no tiene fotografías.</p>}
			</section>

			<section className="profile-information-section">
				<div className="profile-section-heading"><div><span className="profile-eyebrow">Información de la tienda</span><h2>Conoce este espacio</h2></div></div>
				<div className="profile-information-grid">
					<article className="profile-description-card"><span className="profile-card-label">Descripción</span><p>{store.descripcion || 'No registrado'}</p></article>
					<article className="profile-detail-card"><div><span>Teléfono</span><strong>{store.telefono || 'No registrado'}</strong></div><div><span>Dirección</span><strong>{store.direccion || 'No registrado'}</strong></div><div><span>Horario</span><strong>{store.horario || 'No registrado'}</strong></div></article>
				</div>
			</section>

			<section className="profile-location-card">
				<div><span className="profile-eyebrow">Ubicación</span><h2>{hasLocation ? 'Ubicación registrada' : 'Ubicación no registrada'}</h2><p>{store.direccion || 'No hay una dirección registrada.'}</p></div>
				{hasLocation && <div className="profile-map-wrap"><iframe title={`Mapa de ${store.nombre}`} src={mapUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /><p><a href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`} target="_blank" rel="noreferrer">Abrir en OpenStreetMap ↗</a> · © OpenStreetMap contributors</p></div>}
				{!hasLocation && <p className="profile-location-missing">No se muestran coordenadas porque el perfil no contiene una ubicación válida.</p>}
			</section>
		</section>
	)
}

export default PerfilTienda
