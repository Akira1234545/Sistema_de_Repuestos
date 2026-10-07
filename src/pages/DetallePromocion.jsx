import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/authState.js'
import FavoriteToggle from '../components/FavoriteToggle.jsx'
import { obtenerPromocion } from '../services/promocionService.js'
import './Promociones.css'

function DetallePromocion() {
	const { role } = useAuth()
	const { id } = useParams()
	const [item, setItem] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	useEffect(() => {
		let active = true
		obtenerPromocion(id).then((data) => { if (active) setItem(data) }).catch((cause) => { if (active) setError(`No se pudo cargar la promoción: ${cause.message}`) }).finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [id])
	if (loading) return <main className="promo-page"><p className="promo-state">Cargando detalle…</p></main>
	if (error) return <main className="promo-page"><p className="promo-error" role="alert">{error}</p></main>
	if (!item) return <main className="promo-page"><div className="promo-state"><h1>Promoción no disponible</h1><p>La oferta pudo haber vencido o estar pausada.</p><Link to="/promociones">Ver promociones vigentes</Link></div></main>
	const valid = item.estado === 'activa' && new Date(item.fecha_inicio) <= new Date() && new Date(item.fecha_fin) > new Date()
	return <main className="promo-page"><article className="promo-detail"><p className="promo-eyebrow">{item.categoriaNombre} · {item.estado === 'activa' ? 'Activa' : item.estado}</p><h1>{item.titulo}</h1>{item.marca && <p className="promo-brand">Marca: {item.marca}</p>}<p className="promo-description">{item.descripcion || 'Sin descripción adicional.'}</p>{item.caracteristicas && <section><h2>Características</h2><p>{item.caracteristicas}</p></section>}<div className="promo-prices"><del>{new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(item.precio_anterior))}</del><strong>{new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(item.precio_oferta))}</strong><span>{Number(item.porcentaje_descuento || 0).toFixed(0)}% menos</span></div><p className="promo-dates">Desde {new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(item.fecha_inicio))} hasta {new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(item.fecha_fin))}</p>{valid && <FavoriteToggle type="promocion" itemId={item.id} label="promoción" />}{!valid && <p className="promo-state">Esta promoción no está vigente actualmente.</p>}<p><Link to="/promociones">← Volver a promociones</Link> · <Link to={role === 'tienda' ? '/tienda' : '/cliente'}>Volver al panel</Link></p></article></main>
}
export default DetallePromocion
