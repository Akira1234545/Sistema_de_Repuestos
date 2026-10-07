import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authState.js'
import FavoriteToggle from '../components/FavoriteToggle.jsx'
import { obtenerPromocionesDisponibles } from '../services/promocionService.js'
import './Promociones.css'

function money(value) { return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value)) }
function PromoCard({ item }) {
	return <article className="promo-card"><p className="promo-category">{item.categoriaNombre}</p><h2>{item.titulo}</h2>{item.marca && <p className="promo-brand">{item.marca}</p>}<p className="promo-description">{item.descripcion || 'Promoción de repuestos para tu vehículo.'}</p><div className="promo-prices"><del>{money(item.precio_anterior)}</del><strong>{money(item.precio_oferta)}</strong><span>{Number(item.porcentaje_descuento || 0).toFixed(0)}% menos</span></div><p className="promo-dates">Disponible hasta {new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(item.fecha_fin))}</p><div className="promo-actions"><Link className="button promo-button" to={`/promociones/${item.id}`}>Ver promoción</Link><FavoriteToggle type="promocion" itemId={item.id} label="promoción" /></div></article>
}
function Promociones() {
	const { role } = useAuth()
	const [items, setItems] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	useEffect(() => {
		let active = true
		obtenerPromocionesDisponibles().then((data) => { if (active) setItems(data) }).catch((cause) => { if (active) setError(`No se pudieron cargar las promociones: ${cause.message}`) }).finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [])
	return <main className="promo-page"><header className="promo-page-heading"><div><p className="promo-eyebrow">RepuestosPro / Ofertas</p><h1>Promociones disponibles</h1><p>Ofertas activas dentro de su periodo de vigencia.</p><Link to={role === 'tienda' ? '/tienda' : '/cliente'}>Volver al panel</Link></div>{role === 'tienda' && <Link className="button promo-button" to="/tienda/promociones">Administrar mis promociones</Link>}</header>
		{loading && <p className="promo-state">Cargando promociones…</p>}{error && <p className="promo-error" role="alert">{error}</p>}{!loading && !error && !items.length && <div className="promo-state"><h2>No hay promociones vigentes</h2><p>Vuelve a consultar más adelante.</p></div>}
		{!loading && !error && items.length > 0 && <div className="promo-grid">{items.map((item) => <PromoCard item={item} key={item.id} />)}</div>}
	</main>
}
export default Promociones
