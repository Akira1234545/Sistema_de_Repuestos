import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Header from '../components/Header.jsx'
import Icon from '../components/Icon.jsx'
import BrakeAssembly from '../components/home/BrakeAssembly.jsx'
import { useAuth } from '../context/authState.js'
import { obtenerCategoriasActivas } from '../services/solicitudService.js'
import { panelPath } from '../lib/roles.js'
import BrandLogo from '../components/BrandLogo.jsx'

gsap.registerPlugin(ScrollTrigger)

const steps = [
	{ kicker: 'Paso 01', title: 'Describe lo que necesitas', detail: 'Registra tu vehículo y publica una solicitud de repuestos.' },
	{ kicker: 'Paso 02', title: 'Compara propuestas', detail: 'Revisa precios totales, disponibilidad y garantías de las tiendas.' },
	{ kicker: 'Paso 03', title: 'Confirma la atención', detail: 'Selecciona una tienda, confirma la atención recibida y deja tu reseña.' },
]

const benefits = [
	{ icon: 'requests', title: 'Una sola solicitud', text: 'Cuentas qué necesitas una vez y las tiendas que atienden esa categoría te responden.' },
	{ icon: 'proposal', title: 'Precios totales claros', text: 'Cada propuesta indica el precio total por la cantidad que pediste, junto con marca, disponibilidad y garantía.' },
	{ icon: 'store', title: 'Tiendas aprobadas', text: 'Solo las tiendas revisadas y activas pueden enviar propuestas y publicar promociones.' },
	{ icon: 'star', title: 'Reseñas verificadas', text: 'Solo quien confirmó la atención de una tienda puede calificarla.' },
]

function useLandingMotion(rootRef, ready) {
	useLayoutEffect(() => {
		const root = rootRef.current
		if (!root) return undefined
		const context = gsap.context(() => {
			const media = gsap.matchMedia()

			media.add('(prefers-reduced-motion: no-preference)', () => {
				// Hero entrance
				gsap.timeline({ defaults: { ease: 'power3.out' } })
					.from('.hero-word', { yPercent: 110, opacity: 0, duration: 1, stagger: .07 })
					.from('.hero-copy [data-hero-fade]', { y: 24, opacity: 0, duration: .8, stagger: .1 }, '-=.6')
					.from('.hero-card', { y: 60, opacity: 0, rotate: (index) => [-6, 4, -3][index], duration: 1, stagger: .12 }, '-=.9')
					.from('.hero-rotor', { scale: .7, opacity: 0, rotate: -60, duration: 1.4 }, '<')

				// Hero parallax, tied to scroll progress through the hero
				const hero = gsap.timeline({ scrollTrigger: { trigger: '.home-hero', start: 'top top', end: 'bottom top', scrub: .6 } })
				hero.to('.hero-grid', { yPercent: 18, ease: 'none' }, 0)
					.to('.hero-rotor', { yPercent: 28, rotate: 140, ease: 'none' }, 0)
					.to('.hero-card-1', { yPercent: -60, ease: 'none' }, 0)
					.to('.hero-card-2', { yPercent: -25, ease: 'none' }, 0)
					.to('.hero-card-3', { yPercent: -100, ease: 'none' }, 0)
					.to('.hero-copy', { yPercent: -12, ease: 'none' }, 0)

				// Category name band drifts opposite to the scroll direction
				gsap.to('.category-band-track', { xPercent: -35, ease: 'none', scrollTrigger: { trigger: '.category-band', start: 'top bottom', end: 'bottom top', scrub: .4 } })

				// Generic reveals
				ScrollTrigger.batch('[data-reveal]', {
					start: 'top 88%',
					once: true,
					onEnter: (elements) => gsap.from(elements, { y: 36, opacity: 0, duration: .9, ease: 'power3.out', stagger: .08, overwrite: true }),
				})

				// Store CTA headline scales into place
				gsap.from('.store-cta h2', { scale: .92, opacity: .4, ease: 'none', scrollTrigger: { trigger: '.store-cta', start: 'top 90%', end: 'center 60%', scrub: true } })
			})

			// Signature moment: the brake assembles as the visitor moves through the three steps
			media.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
				const stepNodes = gsap.utils.toArray('.process-step')
				const setActive = (progress) => {
					const active = Math.min(stepNodes.length - 1, Math.floor(progress * stepNodes.length * .999))
					stepNodes.forEach((node, index) => node.classList.toggle('is-active', index === active))
					root.querySelector('.process-meter-fill')?.style.setProperty('--progress', progress.toFixed(3))
				}
				const assembly = gsap.timeline({
					defaults: { ease: 'power2.inOut' },
					scrollTrigger: {
						trigger: '.process-section', start: 'top top', end: '+=220%', pin: '.process-pin', scrub: .8,
						onUpdate: (self) => setActive(self.progress),
					},
				})
				assembly
					.fromTo('.process-stage [data-part="rotor"]', { scale: .55, rotate: -120, opacity: .25, transformOrigin: '50% 50%' }, { scale: 1, rotate: 0, opacity: 1, duration: 1 })
					.fromTo('.process-stage [data-part="caliper"]', { x: 140, y: -150, rotate: 25, opacity: 0, transformOrigin: '75% 25%' }, { x: 0, y: 0, rotate: 0, opacity: 1, duration: 1 })
					.fromTo('.process-stage [data-part="pads"]', { x: 60, y: -70, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: .6 })
					.to('.process-stage [data-part="heat"]', { opacity: .75, duration: .4 })
					.to('.process-stage .brake-assembly', { rotate: 8, scale: 1.04, duration: .4 }, '<')
				setActive(0)
				return () => stepNodes.forEach((node) => node.classList.remove('is-active'))
			})
		}, root)
		return () => context.revert()
	}, [rootRef, ready])
}

function Home() {
	const navigate = useNavigate()
	const { role, user } = useAuth()
	const panel = panelPath(role)
	const [categories, setCategories] = useState([])
	const [categoryState, setCategoryState] = useState('loading')
	const rootRef = useRef(null)

	useEffect(() => {
		let active = true
		obtenerCategoriasActivas()
			.then((data) => { if (active) { setCategories(data); setCategoryState('ready') } })
			.catch(() => { if (active) setCategoryState('error') })
		return () => { active = false }
	}, [])

	useLandingMotion(rootRef, categoryState)
	useEffect(() => { ScrollTrigger.refresh() }, [categoryState])

	function search(event) {
		event.preventDefault()
		const term = String(new FormData(event.currentTarget).get('buscar') || '').trim()
		navigate(term ? `/promociones?q=${encodeURIComponent(term)}` : '/promociones')
	}

	const categoryNames = categories.slice(0, 14).map((category) => category.nombre)
	const bandWords = categoryNames.length ? categoryNames : ['Frenos', 'Motor', 'Suspensión', 'Transmisión', 'Eléctrico', 'Carrocería']

	return (
		<div className="public-home" ref={rootRef}>
			<a className="skip-link" href="#contenido">Ir al contenido</a>
			<Header />
			<main id="contenido" tabIndex={-1}>
				<section className="home-hero section-dark" aria-labelledby="hero-title">
					<div className="hero-grid" aria-hidden="true" />
					<div className="hero-copy">
						<p className="eyebrow" data-hero-fade>DriveFix · Tu aliado automotor</p>
						<h1 id="hero-title">
							<span className="hero-line"><span className="hero-word">Tu</span> <span className="hero-word">vehículo,</span></span>{' '}
							<span className="hero-line"><em><span className="hero-word">en</span> <span className="hero-word">buenas</span> <span className="hero-word">manos</span></em></span>
						</h1>
						<p className="hero-text" data-hero-fade>Encuentra repuestos confiables y tiendas especializadas para mantener tu vehículo listo para la ruta.</p>
						<div className="hero-actions" data-hero-fade>
							<Link className="button button-primary button-lg" to={user ? panel : '/register'}>{user ? 'Ir a mi panel' : 'Comenzar ahora'} <span aria-hidden="true">→</span></Link>
							<Link className="button button-secondary button-lg" to="/tiendas">Explorar tiendas</Link>
						</div>
						<ul className="hero-points" data-hero-fade>
							<li>Busca</li><li>Compara</li><li>Decide</li>
						</ul>
					</div>
					<div className="hero-stage" aria-hidden="true">
						<BrakeAssembly idPrefix="hero" className="hero-rotor" />
						<div className="hero-card hero-card-1">
							<span className="hero-card-kicker">Solicitud publicada</span>
							<strong>Pastillas de freno delanteras</strong>
							<span className="hero-card-meta">Frenos · 2 unidades</span>
						</div>
						<div className="hero-card hero-card-2">
							<span className="hero-card-kicker hero-card-kicker-steel">Propuesta de tienda</span>
							<strong>Precio total, marca y garantía</strong>
							<span className="hero-card-status">Enviada</span>
						</div>
						<div className="hero-card hero-card-3">
							<span className="hero-card-stars">★★★★★</span>
							<strong>Atención confirmada</strong>
						</div>
					</div>
					<a className="hero-scroll" href="#como-funciona"><span>Cómo funciona</span><i aria-hidden="true" /></a>
				</section>

				<section className="search-panel" aria-labelledby="search-title" data-reveal>
					<div>
						<p className="eyebrow">Encuentra lo que necesitas</p>
						<h2 id="search-title">¿Qué estás buscando hoy?</h2>
					</div>
					<form className="search-box" role="search" onSubmit={search}>
						<span aria-hidden="true">⌕</span>
						<input name="buscar" type="search" maxLength={160} placeholder="Buscar en promociones…" aria-label="Buscar promociones" />
						<button type="submit">Buscar</button>
					</form>
				</section>

				<div className="category-band" aria-hidden="true">
					<div className="category-band-track">{[...bandWords, ...bandWords].map((word, index) => <span key={index}>{word}<i>✦</i></span>)}</div>
				</div>

				<section id="categorias" className="home-section categories-section" aria-labelledby="categorias-title">
					<div className="section-heading inline-heading" data-reveal>
						<div><p className="eyebrow">Explora por categoría</p><h2 id="categorias-title">La pieza correcta empieza aquí</h2></div>
						<Link className="text-button" to={user && role === 'cliente' ? '/cliente/solicitudes/crear' : '/register?role=cliente'}>Publicar una solicitud →</Link>
					</div>
					{categoryState === 'error' && <p className="request-history-notice" role="status">No se pudieron cargar las categorías. Puedes explorar las tiendas mientras tanto.</p>}
					{categoryState === 'loading' && <p className="request-loading" role="status">Cargando categorías…</p>}
					{categoryState === 'ready' && categories.length === 0 && <p className="request-history-notice" role="status">Todavía no hay categorías activas.</p>}
					<div className="category-list">{categories.slice(0, 12).map((category, index) => <Link className="category-item" data-reveal key={category.id} to={`/cliente/solicitudes/crear?categoria=${category.id}`}>
						<span className="category-index">{String(index + 1).padStart(2, '0')}</span>
						<strong>{category.nombre}</strong>
						<b aria-hidden="true">→</b>
					</Link>)}</div>
				</section>

				<section id="como-funciona" className="process-section section-dark" aria-labelledby="process-title">
					<div className="process-pin">
						<div className="process-copy">
							<div className="section-heading">
								<p className="eyebrow">Paso a paso</p>
								<h2 id="process-title">Cómo funciona DriveFix</h2>
							</div>
							<ol className="process-steps">
								{steps.map((step) => <li className="process-step" key={step.title}>
									<span className="process-step-kicker">{step.kicker}</span>
									<h3>{step.title}</h3>
									<p>{step.detail}</p>
								</li>)}
							</ol>
							<div className="process-meter" aria-hidden="true"><span className="process-meter-fill" /></div>
						</div>
						<div className="process-stage" aria-hidden="true">
							<div className="process-stage-rings" />
							<BrakeAssembly idPrefix="process" />
						</div>
					</div>
				</section>

				<section className="home-section benefits-section" aria-labelledby="benefits-title">
					<div className="section-heading inline-heading" data-reveal>
						<div><p className="eyebrow">Una plataforma para avanzar</p><h2 id="benefits-title">Todo lo que necesitas para cuidar tu vehículo, en un solo lugar.</h2></div>
						<Link className="text-button" to="/promociones">Ver promociones →</Link>
					</div>
					<div className="feature-grid">{benefits.map((benefit, index) => <article className="part-card" key={benefit.title} data-reveal>
						<span className="card-number">0{index + 1}</span>
						<span className="part-icon"><Icon name={benefit.icon} size={22} /></span>
						<h3>{benefit.title}</h3>
						<p>{benefit.text}</p>
					</article>)}</div>
				</section>

				<section id="tiendas" className="home-section stores-section" aria-labelledby="stores-title">
					<div className="stores-panel" data-reveal>
						<div>
							<p className="eyebrow">Perfiles aprobados</p>
							<h2 id="stores-title">Explora tiendas de repuestos</h2>
							<p>Consulta la presentación de las tiendas activas. El teléfono se publica en sus promociones y la ubicación se comparte al seleccionar una propuesta.</p>
						</div>
						<Link className="button button-secondary button-lg" to="/tiendas">Ver catálogo de tiendas →</Link>
					</div>
				</section>

				<section className="store-cta section-dark" aria-labelledby="cta-title">
					<div className="store-cta-inner">
						<p className="eyebrow">¿Tienes una tienda?</p>
						<h2 id="cta-title">Haz que encuentren tu tienda</h2>
						<p>Presenta tus repuestos a personas que ya están buscando soluciones confiables.</p>
						<Link className="button button-primary button-lg" to={role === 'tienda' ? '/tienda' : '/register?role=tienda'}>{role === 'tienda' ? 'Administrar mi tienda' : 'Registrar mi tienda'} <span aria-hidden="true">→</span></Link>
					</div>
				</section>
			</main>
			<footer className="home-footer section-dark">
				<Link className="brand" to="/"><BrandLogo variant="dark" /></Link>
				<nav aria-label="Enlaces del pie de página"><Link to="/tiendas">Tiendas</Link><Link to="/promociones">Promociones</Link><Link to="/login">Iniciar sesión</Link><Link to="/register">Registrarse</Link></nav>
				<p>Tu vehículo, en buenas manos. © {new Date().getFullYear()} DriveFix</p>
			</footer>
		</div>
	)
}

export default Home
