import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header.jsx'
import { useAuth } from '../context/authState.js'
import './Home.css'
import { useEffect, useState } from 'react'
import { obtenerCategoriasActivas } from '../services/solicitudService.js'

const featuredParts = [
	{ name: 'Describe lo que necesitas', detail: 'Registra tu vehículo y publica una solicitud de repuestos.' },
	{ name: 'Compara propuestas', detail: 'Revisa precios totales, disponibilidad y garantías de las tiendas.' },
	{ name: 'Confirma la atención', detail: 'Selecciona una tienda, confirma la atención recibida y deja tu reseña.' },
]

function Home() {
	const navigate = useNavigate()
	const { role, user } = useAuth()
	const panel = role === 'tienda' ? '/tienda' : role === 'cliente' ? '/cliente' : '/admin'
	const [categories, setCategories] = useState([])
	const [categoryError, setCategoryError] = useState(false)
	useEffect(() => {
		let active = true
		obtenerCategoriasActivas().then(data => { if (active) setCategories(data) }).catch(() => { if (active) setCategoryError(true) })
		return () => { active = false }
	}, [])

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
			<a className="skip-link" href="#contenido">Ir al contenido</a>
			<main id="contenido" tabIndex={-1}>
				<section className="home-hero">
					<div className="hero-copy">
						<p className="eyebrow">RepuestosPro / Tu aliado automotor</p>
						<h1>Tu vehículo, <em>en buenas manos</em></h1>
						<p className="hero-text">
							Encuentra repuestos confiables y tiendas especializadas para mantener tu vehículo listo para la ruta.
						</p>
						<div className="hero-actions">
							<Link className="button button-primary" to={user ? panel : '/register'}>{user ? 'Ir a mi panel' : 'Comenzar ahora'} <span aria-hidden="true">↗</span></Link>
							<Link className="button button-secondary" to="/tiendas">Explorar tiendas</Link>
						</div>
					</div>
					<div className="hero-note">
						<span>TU PRÓXIMO REPUESTO</span>
						<strong>Busca. Compara. Decide.</strong>
						<p>Una forma más clara de cuidar lo que te mueve.</p>
						<ol className="hero-note-steps"><li><b>01</b> Cuéntanos qué necesitas</li><li><b>02</b> Recibe propuestas de tiendas</li><li><b>03</b> Elige con más información</li></ol>
					</div>
				</section>

				<section className="search-panel" aria-label="Buscar repuestos">
					<div>
						<p className="eyebrow">Encuentra lo que necesitas</p>
						<h2>¿Qué estás buscando hoy?</h2>
					</div>
					<form className="search-box" onSubmit={event => { event.preventDefault(); navigate(`/promociones?q=${encodeURIComponent(new FormData(event.currentTarget).get('buscar').trim())}`) }}>
						<input name="buscar" type="search" maxLength={160} placeholder="Buscar en promociones…" aria-label="Buscar promociones" />
						<button type="submit">Buscar</button>
					</form>
				</section>

				<section id="categorias" className="home-section categories-section">
					<div className="section-heading"><p className="eyebrow">Explora por categoría</p><h2>La pieza correcta empieza aquí</h2></div>
					{categoryError && <p role="status">No se pudieron cargar las categorías. Puedes explorar las tiendas.</p>}
					<div className="category-list">{categories.slice(0, 12).map((category, index) => <Link className="category-item" key={category.id} to={`/cliente/solicitudes/crear?categoria=${category.id}`}><span>{String(index + 1).padStart(2, '0')}</span>{category.nombre}<b>↗</b></Link>)}</div>
				</section>

				<section className="home-section tinted-section">
					<div className="section-heading inline-heading"><div><p className="eyebrow">Paso a paso</p><h2>Cómo funciona RepuestosPro</h2></div><Link className="text-button" to="/promociones">Ver promociones ↗</Link></div>
					<div className="feature-grid">{featuredParts.map((part, index) => <article className="part-card" key={part.name}><span className="card-number">0{index + 1}</span><div className="part-icon">✦</div><h3>{part.name}</h3><p>{part.detail}</p></article>)}</div>
				</section>

				<section id="tiendas" className="home-section stores-section">
					<div className="section-heading inline-heading"><div><p className="eyebrow">Perfiles aprobados</p><h2>Explora tiendas de repuestos</h2></div><Link className="text-button" to="/tiendas">Ver catálogo ↗</Link></div>
					<p>Consulta la presentación de las tiendas activas. El teléfono se publica en sus promociones y la ubicación se comparte al seleccionar una propuesta.</p>
				</section>

				<section className="platform-section"><div><p className="eyebrow">Una plataforma para avanzar</p><h2>Todo lo que necesitas para cuidar tu vehículo, en un solo lugar.</h2></div><div className="platform-facts"><div><strong>01</strong><span>Publica tu solicitud</span></div><div><strong>02</strong><span>Compara propuestas</span></div><div><strong>03</strong><span>Confirma la atención</span></div></div></section>

				<section className="store-cta"><div><p className="eyebrow">¿Tienes una tienda?</p><h2>Haz que encuentren tu tienda</h2><p>Presenta tus repuestos a personas que ya están buscando soluciones confiables.</p></div><button type="button" className="button button-light" onClick={handleStoreCta}>{role === 'tienda' ? 'Administrar mi tienda' : 'Registrar mi tienda'} <span aria-hidden="true">↗</span></button></section>
			</main>
			<footer className="home-footer"><strong>Repuestos<span>Pro</span></strong><p>Tu vehículo, en buenas manos.</p><span>© 2026 RepuestosPro</span></footer>
		</div>
	)
}

export default Home
