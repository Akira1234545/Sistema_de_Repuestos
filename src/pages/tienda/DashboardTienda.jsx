import { Link } from 'react-router-dom'
import './TiendaPages.css'

function DashboardTienda() {
	return (
		<section className="store-page store-dashboard">
			<div className="store-hero">
				<p className="store-eyebrow">PANEL DE TIENDA</p>
				<h1>Bienvenido a tu tienda</h1>
				<p className="store-lead">Desde aquí puedes administrar la información de tu tienda, revisar tus solicitudes y mantener todo al día.</p>
			</div>
			<div className="store-divider" />
			<div className="store-actions">
				<Link className="store-action-card" to="/tienda/perfil"><span>01</span><strong>Mi tienda</strong><p>Consulta y administra la información de tu tienda.</p><b>↗</b></Link>
				<Link className="store-action-card store-action-dark" to="/tienda/editar"><span>02</span><strong>Editar tienda</strong><p>Actualiza los datos de tu tienda y mantén tu información al día.</p><b>↗</b></Link>
				<Link className="store-action-card" to="/tienda/solicitudes"><span>03</span><strong>Solicitudes disponibles</strong><p>Revisa las solicitudes de repuestos disponibles.</p><b>↗</b></Link>
			</div>
		</section>
	)
}

export default DashboardTienda
