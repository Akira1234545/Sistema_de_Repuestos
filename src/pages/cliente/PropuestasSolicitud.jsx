import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import FavoriteToggle from '../../components/FavoriteToggle.jsx'
import { obtenerPropuestasDeSolicitud, seleccionarPropuesta } from '../../services/propuestaService.js'
import { obtenerSolicitudPorId } from '../../services/solicitudService.js'
import './Solicitudes.css'

const statusLabels = { enviada: 'Enviada', aceptada: 'Seleccionada', rechazada: 'No seleccionada', retirada: 'Retirada' }
function money(value) { return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value)) }
function date(value) { return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function validCoordinates(store) {
	const lat = Number(store?.latitud); const lon = Number(store?.longitud)
	return store?.latitud !== null && store?.latitud !== '' && store?.longitud !== null && store?.longitud !== ''
		&& Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}
function mapUrl(store) {
	const lat = Number(store.latitud); const lon = Number(store.longitud); const pad = 0.015
	const params = new URLSearchParams({ bbox: `${lon - pad},${lat - pad},${lon + pad},${lat + pad}`, layer: 'mapnik', marker: `${lat},${lon}` })
	return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`
}

function PropuestasSolicitud() {
	const { id } = useParams()
	const { user } = useAuth()
	const [request, setRequest] = useState(null)
	const [proposals, setProposals] = useState([])
	const [loading, setLoading] = useState(true)
	const [selectingId, setSelectingId] = useState('')
	const [error, setError] = useState('')
	const [refresh, setRefresh] = useState(0)
	useEffect(() => {
		let active = true
		Promise.all([obtenerSolicitudPorId(id, user.id), obtenerPropuestasDeSolicitud(id)])
			.then(([requestData, proposalData]) => { if (active) { setRequest(requestData); setProposals(proposalData); setError('') } })
			.catch((loadError) => { if (active) setError(`No se pudieron cargar las propuestas: ${loadError.message}`) })
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [id, user.id, refresh])
	async function choose(proposal) {
		if (!window.confirm('¿Quieres seleccionar esta propuesta? Las demás propuestas abiertas quedarán rechazadas.')) return
		setSelectingId(proposal.id); setError('')
		try { await seleccionarPropuesta(id, proposal.id); setRefresh((value) => value + 1) }
		catch (selectError) { setError(`No se pudo seleccionar la propuesta: ${selectError.message}`) }
		finally { setSelectingId('') }
	}
	if (loading) return <section className="requests-page"><p className="request-loading">Cargando propuestas...</p></section>
	if (error && !request) return <section className="requests-page"><p className="request-error" role="alert">{error}</p><Link to="/cliente/solicitudes">Volver a mis solicitudes</Link></section>
	if (!request) return null
	const canSelect = ['publicada', 'recibiendo_propuestas'].includes(request.estado)
	return <section className="requests-page proposal-comparison">
		<div className="requests-heading"><div><p className="requests-eyebrow">Panel de cliente / Solicitud</p><h1>Propuestas recibidas</h1><p className="requests-lead">{request.titulo} · Estado: {request.estado.replaceAll('_', ' ')}</p></div><Link className="button requests-button" to="/cliente/solicitudes">Volver a solicitudes</Link></div>
		{error && <p className="request-error" role="alert">{error}</p>}
		{proposals.length === 0 ? <div className="request-empty"><h2>Aún no hay propuestas</h2><p>Las tiendas todavía no han respondido a esta solicitud.</p></div> : <div className="proposal-comparison-grid">{proposals.map((proposal) => {
			const selected = request.propuesta_seleccionada_id === proposal.id && proposal.estado === 'aceptada'
			const shop = proposal.tienda
			return <article className={`proposal-card${selected ? ' proposal-card-selected' : ''}`} key={proposal.id}>
				<div className="proposal-card-heading"><div><p className="requests-eyebrow">{selected ? 'Tu selección' : 'Propuesta'}</p><h2>{shop?.nombre || 'Tienda'}</h2></div><span className={`proposal-status proposal-status-${proposal.estado}`}>{statusLabels[proposal.estado] || proposal.estado}</span></div>
				<strong className="proposal-price">{money(proposal.precio)}</strong>
				<dl className="proposal-data"><div><dt>Marca</dt><dd>{proposal.marca}</dd></div><div><dt>Disponibilidad</dt><dd>{proposal.disponibilidad}</dd></div>{proposal.garantia && <div><dt>Garantía</dt><dd>{proposal.garantia}</dd></div>}{proposal.caracteristicas && <div><dt>Características</dt><dd>{proposal.caracteristicas}</dd></div>}{proposal.observaciones && <div><dt>Observaciones</dt><dd>{proposal.observaciones}</dd></div>}<div><dt>Recibida</dt><dd>{date(proposal.fecha_creacion)}</dd></div></dl>
				{selected && shop && <section className="selected-shop-contact"><h3>Contacto y ubicación de la tienda</h3><p><strong>Teléfono:</strong> {shop.telefono ? <a href={`tel:${shop.telefono}`}>{shop.telefono}</a> : 'No registrado'}</p><p><strong>Dirección:</strong> {shop.direccion || 'No registrada'}</p><FavoriteToggle type="tienda" itemId={shop.id} label="tienda" />
					{validCoordinates(shop) ? <div className="osm-map-wrap"><iframe title={`Mapa de ${shop.nombre}`} src={mapUrl(shop)} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /><p><a href={`https://www.openstreetmap.org/?mlat=${shop.latitud}&mlon=${shop.longitud}#map=16/${shop.latitud}/${shop.longitud}`} target="_blank" rel="noreferrer">Abrir mapa de OpenStreetMap ↗</a> · © OpenStreetMap contributors</p></div> : <p className="map-unavailable">El perfil de la tienda no tiene coordenadas válidas; se muestra únicamente la dirección disponible.</p>}
				</section>}
				{selected && !shop && <p className="map-unavailable" role="status">La propuesta está seleccionada, pero no se pudo consultar el perfil de contacto de la tienda.</p>}
				{canSelect && proposal.estado === 'enviada' && <button className="button proposal-select" type="button" onClick={() => choose(proposal)} disabled={Boolean(selectingId)}>{selectingId === proposal.id ? 'Seleccionando…' : 'Seleccionar propuesta'}</button>}
			</article>
		})}</div>}
	</section>
}
export default PropuestasSolicitud
