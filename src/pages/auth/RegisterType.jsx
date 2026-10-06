import { Link, useNavigate } from 'react-router-dom'
import './RegisterType.css'

function RegisterType() {
	const navigate = useNavigate()

	return (
		<main className="register-type-page">
			<div className="register-type-header"><Link className="brand" to="/"><span>R</span>Repuestos<strong>Pro</strong></Link><Link className="back-link" to="/">Volver al inicio</Link></div>
			<section className="register-type-content">
				<p className="eyebrow">Primer paso</p><h1>¿Cómo deseas registrarte?</h1><p className="register-type-lead">Elige el camino que mejor se adapta a lo que necesitas.</p>
				<div className="account-options">
					<article className="account-card client-card"><span className="account-icon">👤</span><p className="card-kicker">Para conductores</p><h2>Cliente</h2><p>Quiero buscar repuestos para mi vehículo</p><button className="button button-primary" type="button" onClick={() => navigate('/register?role=cliente')}>Continuar como cliente <span>↗</span></button></article>
					<article className="account-card store-card"><span className="account-icon">🏪</span><p className="card-kicker">Para negocios</p><h2>Tienda</h2><p>Quiero ofrecer mis repuestos y crear la página de mi tienda</p><button className="button button-dark" type="button" onClick={() => navigate('/register?role=tienda')}>Continuar como tienda <span>↗</span></button></article>
				</div>
			</section>
		</main>
	)
}

export default RegisterType