import { publicError } from '../../lib/errors.js'
import StoreMap from '../../components/StoreMap.jsx'
import { useToast } from '../../context/toastState.js'
import { useConfirm } from '../../context/confirmState.js'
import { refreshPanelBadges } from '../../lib/events.js'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../context/authState.js'
import FavoriteToggle from '../../components/FavoriteToggle.jsx'
import ResenaTienda from '../../components/ResenaTienda.jsx'
import { cancelarSeleccion, obtenerPropuestasDeSolicitud, seleccionarPropuesta } from '../../services/propuestaService.js'
import { cerrarSolicitud, confirmarAtencion, obtenerSolicitudPorId } from '../../services/solicitudService.js'
import { whatsappPhone, statusLabel } from '../../lib/format.js'

const statusLabels = { enviada: 'Enviada', aceptada: 'Seleccionada', rechazada: 'No seleccionada', retirada: 'Retirada' }
function money(value) { return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(Number(value)) }
function date(value) { return new Intl.DateTimeFormat('es', { timeZone: 'America/La_Paz', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }


function PropuestasSolicitud() {
	const { id } = useParams()
	const { user } = useAuth()
	const toast = useToast()
	const confirm = useConfirm()
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
			.catch((loadError) => { if (active) setError(`No se pudieron cargar las propuestas: ${publicError(loadError)}`) })
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [id, user.id, refresh])
	async function choose(proposal) {
		if (!(await confirm({ title: '¿Seleccionar esta propuesta?', message: 'Las demás quedarán como no seleccionadas. Si la tienda no te atiende, podrás cancelar la selección y volverán a estar disponibles.', confirmLabel: 'Seleccionar' }))) return
		setSelectingId(proposal.id); setError('')
		try { await seleccionarPropuesta(id, proposal.id); toast({ title: 'Propuesta seleccionada', description: 'Ya puedes ver el contacto y la ubicación de la tienda.', tone: 'success' }); setRefresh((value) => value + 1); refreshPanelBadges() }
		catch (selectError) { setError(`No se pudo seleccionar la propuesta: ${publicError(selectError)}`) }
		finally { setSelectingId('') }
	}
	async function complete() {
		if (!(await confirm({ title: '¿La tienda atendió tu solicitud?', message: 'Después podrás dejar tu reseña. Esta acción no se puede deshacer.', confirmLabel: 'Sí, me atendió' }))) return
		setSelectingId('attention'); setError('')
		try { await confirmarAtencion(id); toast({ title: 'Atención confirmada', description: 'Cuéntanos cómo te fue dejando tu reseña.', tone: 'success' }); setRefresh((value) => value + 1); refreshPanelBadges() }
		catch (cause) { setError(`No se pudo confirmar la atención: ${publicError(cause)}`) }
		finally { setSelectingId('') }
	}
	// E12: la tienda elegida no atiende → su propuesta queda rechazada y las demás vuelven a competir.
	async function cancelSelection() {
		if (!(await confirm({ title: '¿Cancelar la selección?', message: 'La propuesta elegida quedará rechazada, avisaremos a la tienda y podrás elegir otra propuesta o recibir nuevas.', confirmLabel: 'Cancelar selección', cancelLabel: 'Volver', tone: 'danger' }))) return
		setSelectingId('cancel'); setError('')
		try { await cancelarSeleccion(id); toast({ title: 'Selección cancelada', description: 'Tu solicitud vuelve a recibir propuestas.', tone: 'success' }); setRefresh((value) => value + 1); refreshPanelBadges() }
		catch (cause) { setError(`No se pudo cancelar la selección: ${publicError(cause)}`) }
		finally { setSelectingId('') }
	}
	async function closeRequest() {
		if (!(await confirm({ title: '¿Cerrar la solicitud?', message: 'La propuesta seleccionada quedará rechazada y no recibirás más propuestas.', confirmLabel: 'Cerrar solicitud', cancelLabel: 'Volver', tone: 'danger' }))) return
		setSelectingId('close'); setError('')
		try { await cerrarSolicitud(id, user.id); toast({ title: 'Solicitud cerrada', tone: 'success' }); setRefresh((value) => value + 1); refreshPanelBadges() }
		catch (cause) { setError(`No se pudo cerrar la solicitud: ${publicError(cause)}`) }
		finally { setSelectingId('') }
	}
	if (loading) return <section className="requests-page"><p className="request-loading">Cargando propuestas...</p></section>
	if (error && !request) return <section className="requests-page"><p className="request-error" role="alert">{error}</p><Link to="/cliente/solicitudes">Volver a mis solicitudes</Link></section>
	if (!request) return <section className="requests-page"><h1>Solicitud no disponible</h1><Link to="/cliente/solicitudes">Volver a mis solicitudes</Link></section>
	const canSelect = ['publicada', 'recibiendo_propuestas'].includes(request.estado)
	return <section className="requests-page proposal-comparison">
		<div className="requests-heading"><div><p className="requests-eyebrow">Panel de cliente / Solicitud</p><h1>Propuestas recibidas</h1><p className="requests-lead">{request.titulo} · Estado: {statusLabel(request.estado)}</p></div><Link className="button button-secondary" to="/cliente/solicitudes">← Volver a solicitudes</Link></div>
		{error && <p className="request-error" role="alert">{error}</p>}
		<p className="request-history-notice">Cada precio es el total para la cantidad solicitada: <strong>{request.cantidad}</strong>.</p>
		{request.estado === 'propuesta_seleccionada' && <div className="proposal-selection-actions">
			<button className="button" type="button" disabled={Boolean(selectingId)} onClick={complete}>{selectingId === 'attention' ? 'Confirmando…' : 'Confirmar atención recibida'}</button>
			<button className="button button-secondary" type="button" disabled={Boolean(selectingId)} onClick={cancelSelection}>{selectingId === 'cancel' ? 'Cancelando…' : 'La tienda no me atendió: cancelar selección'}</button>
			<button className="button button-secondary is-danger" type="button" disabled={Boolean(selectingId)} onClick={closeRequest}>{selectingId === 'close' ? 'Cerrando…' : 'Cerrar solicitud'}</button>
		</div>}
		{proposals.length === 0 ? <div className="request-empty"><h2>Aún no hay propuestas</h2><p>Las tiendas todavía no han respondido a esta solicitud.</p></div> : <div className="proposal-comparison-grid">{proposals.map((proposal) => {
			const selected = request.propuesta_seleccionada_id === proposal.id && proposal.estado === 'aceptada'
			const shop = proposal.tienda
			const shopWhatsAppPhone = whatsappPhone(shop?.telefono)
			return <article className={`proposal-card${selected ? ' proposal-card-selected' : ''}`} key={proposal.id}>
				<div className="proposal-card-heading"><div><p className="requests-eyebrow">{selected ? 'Tu selección' : 'Propuesta'}</p><h2>{shop?.nombre || 'Tienda no disponible'}</h2></div><span className={`proposal-status proposal-status-${proposal.estado}`}>{statusLabels[proposal.estado] || proposal.estado}</span></div>
				<strong className="proposal-price">{money(proposal.precio)}</strong>
				<dl className="proposal-data"><div><dt>Marca</dt><dd>{proposal.marca}</dd></div><div><dt>Disponibilidad</dt><dd>{proposal.disponibilidad}</dd></div>{proposal.garantia && <div><dt>Garantía</dt><dd>{proposal.garantia}</dd></div>}{proposal.caracteristicas && <div><dt>Características</dt><dd>{proposal.caracteristicas}</dd></div>}{proposal.observaciones && <div><dt>Observaciones</dt><dd>{proposal.observaciones}</dd></div>}<div><dt>Recibida</dt><dd>{date(proposal.fecha_creacion)}</dd></div></dl>
				{selected && shop && <section className="selected-shop-contact"><h3>Contacto y ubicación de la tienda</h3><p className="selected-shop-phone"><strong>Teléfono de contacto</strong>{shop.telefono ? <a href={`tel:${shop.telefono}`}>{shop.telefono}</a> : <span>No registrado</span>}{shopWhatsAppPhone && <a className="whatsapp-link" href={`https://wa.me/${shopWhatsAppPhone}`} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a>}</p><p><strong>Dirección:</strong> {shop.direccion || 'No registrada'}</p><FavoriteToggle type="tienda" itemId={shop.id} label="tienda" />
					<StoreMap name={shop.nombre} address={shop.direccion} lat={shop.latitud} lng={shop.longitud} />
				</section>}
				{selected && !shop && <p className="map-unavailable" role="status">La propuesta está seleccionada, pero no se pudo consultar el perfil de contacto de la tienda.</p>}
				{selected && shop && request.estado === 'atendida' && <ResenaTienda key={proposal.id} usuarioId={user.id} tiendaId={shop.id} propuestaId={proposal.id} tiendaNombre={shop.nombre || 'la tienda'} />}
				{canSelect && proposal.estado === 'enviada' && !shop && <p className="map-unavailable" role="status">Esta tienda ya no está disponible; no se puede seleccionar su propuesta.</p>}
				{canSelect && proposal.estado === 'enviada' && shop && <button className="button proposal-select" type="button" onClick={() => choose(proposal)} disabled={Boolean(selectingId)}>{selectingId === proposal.id ? 'Seleccionando…' : 'Seleccionar propuesta'}</button>}
			</article>
		})}</div>}
	</section>
}
export default PropuestasSolicitud
