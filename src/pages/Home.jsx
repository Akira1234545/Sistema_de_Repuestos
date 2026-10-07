import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { useAuth } from '../context/authState.js'
import './Home.css'

const categories = ['Motor', 'Frenos', 'Suspensión', 'Electricidad', 'Carrocería']

const featuredParts = [
	{ name: 'Kit de pastillas de freno', detail: 'Seguridad y control para cada viaje', price: 'Desde $28' },
	{ name: 'Batería 12V', detail: 'Arranque confiable para tu vehículo', price: 'Desde $75' },
	{ name: 'Filtro de aceite', detail: 'Mantenimiento que protege tu motor', price: 'Desde $12' },
]

function Home() {
	const navigate = useNavigate()
	const { role } = useAuth()

	function handleStoreCta() {
		if (role === 'tienda') {
			navigate('/tienda')
			return
		}

		navigate('/register?role=tienda')
	}

	return (
		<div className="public-home">
			<Header />
			<main>
				<section className="home-hero">
					<div className="hero-copy">
						<p className="eyebrow">RepuestosPro / Tu aliado automotor</p>
						<h1>Tu vehículo, <em>en buenas manos</em></h1>
						<p className="hero-text">
							Encuentra repuestos confiables y tiendas especializadas para mantener tu vehículo listo para la ruta.
						</p>
						<div className="hero-actions">
							<Link className="button button-primary" to="/register">Registrarse</Link>
							<Link className="button button-secondary" to="/login">Iniciar sesión</Link>
						</div>
					</div>
					<div className="hero-note">
						<span>01</span>
						<strong>Busca. Compara. Decide.</strong>
						<p>Una forma más clara de cuidar lo que te mueve.</p>
					</div>
				</section>

				<section className="search-panel" aria-label="Buscar repuestos">
					<div>
						<p className="eyebrow">Encuentra lo que necesitas</p>
						<h2>¿Qué estás buscando hoy?</h2>
					</div>
					<div className="search-box">
						<input type="search" placeholder="Ej. pastillas de freno, batería..." aria-label="Buscar repuestos" />
						<button type="button">Buscar</button>
					</div>
				</section>

				<section id="categorias" className="home-section categories-section">
					<div className="section-heading"><p className="eyebrow">Explora por categoría</p><h2>La pieza correcta empieza aquí</h2></div>
					<div className="category-list">{categories.map((category, index) => <button type="button" className="category-item" key={category}><span>0{index + 1}</span>{category}<b>↗</b></button>)}</div>
				</section>

				<section className="home-section tinted-section">
					<div className="section-heading inline-heading"><div><p className="eyebrow">Selección de la semana</p><h2>Repuestos destacados</h2></div><button type="button" className="text-button">Ver todos ↗</button></div>
					<div className="feature-grid">{featuredParts.map((part, index) => <article className="part-card" key={part.name}><span className="card-number">0{index + 1}</span><div className="part-icon">✦</div><h3>{part.name}</h3><p>{part.detail}</p><strong>{part.price}</strong></article>)}</div>
				</section>

				<section id="tiendas" className="home-section stores-section">
					<div className="section-heading inline-heading"><div><p className="eyebrow">Perfiles aprobados</p><h2>Explora tiendas de repuestos</h2></div><Link className="text-button" to="/tiendas">Ver catálogo ↗</Link></div>
					<p>Consulta la presentación de las tiendas activas. Los datos de contacto aparecen cuando selecciones una de sus propuestas.</p>
				</section>

				<section className="platform-section"><div><p className="eyebrow">Una plataforma para avanzar</p><h2>Todo lo que necesitas para cuidar tu vehículo, en un solo lugar.</h2></div><div className="platform-facts"><div><strong>+500</strong><span>repuestos listos para encontrar</span></div><div><strong>+80</strong><span>tiendas especializadas</span></div><div><strong>24/7</strong><span>tu búsqueda siempre disponible</span></div></div></section>

				<section className="store-cta"><div><p className="eyebrow">¿Tienes una tienda?</p><h2>Crea tu página para tu tienda</h2><p>Presenta tus repuestos a personas que ya están buscando soluciones confiables.</p></div><button type="button" className="button button-light" onClick={handleStoreCta}>Crear mi página para mi tienda ↗</button></section>
			</main>
			<footer className="home-footer"><strong>Repuestos<span>Pro</span></strong><p>Tu vehículo, en buenas manos.</p><span>© 2026 RepuestosPro</span></footer>
		</div>
	)
}

export default Home
