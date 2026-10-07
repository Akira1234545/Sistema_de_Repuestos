import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { obtenerTiendasPublicas } from '../services/tiendaService.js'
import './TiendasPublicas.css'

function TiendasPublicas() {
	const [stores, setStores] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		obtenerTiendasPublicas()
			.then((data) => { if (active) setStores(data) })
			.catch((cause) => { if (active) setError(`No se pudo cargar el catálogo de tiendas: ${cause.message}`) })
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [])

	return <main className="public-stores-page">
		<header className="public-stores-heading">
			<p className="eyebrow">RepuestosPro / Tiendas aprobadas</p>
			<h1>Encuentra una tienda para tu próximo repuesto</h1>
			<p>Explora perfiles activos. El contacto y la ubicación se muestran después de seleccionar una propuesta.</p>
			<Link to="/">Volver al inicio</Link>
		</header>
		{loading && <p className="public-stores-state">Cargando tiendas...</p>}
		{error && <p className="public-stores-error" role="alert">{error}</p>}
		{!loading && !error && stores.length === 0 && <div className="public-stores-state"><h2>Aún no hay tiendas disponibles</h2><p>Las tiendas aprobadas aparecerán aquí.</p></div>}
		{!loading && !error && stores.length > 0 && <div className="public-stores-grid">{stores.map((store) => <article className="public-store-card" key={store.id}>
			{store.fotografias?.[0] ? <img src={store.fotografias[0]} alt={`Imagen de ${store.nombre}`} /> : <div className="public-store-placeholder" aria-hidden="true">R</div>}
			<div className="public-store-copy"><p className="public-store-label">Tienda aprobada</p><h2>{store.nombre}</h2><p>{store.descripcion || 'Perfil de tienda de repuestos.'}</p>{store.horario && <small>Horario: {store.horario}</small>}</div>
		</article>)}</div>}
	</main>
}

export default TiendasPublicas
