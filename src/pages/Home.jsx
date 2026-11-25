import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Header from '../components/Header.jsx'
import Icon from '../components/Icon.jsx'
import BrandLogo from '../components/BrandLogo.jsx'
import BrakeAssembly from '../components/home/BrakeAssembly.jsx'
import CategoryGlyph from '../components/home/CategoryGlyph.jsx'
import HeroScene from '../components/home/HeroScene.jsx'
import { useAuth } from '../context/authState.js'
import { obtenerCategoriasActivas } from '../services/solicitudService.js'
import { obtenerTiendasPublicas } from '../services/tiendaService.js'
import { obtenerResenasPublicasDeTiendas } from '../services/resenaService.js'
import { categoryLink, featuredReviews, finalPaths, heroActions, landingCategories, publicNavLinks, storeLink } from '../lib/publicNav.js'
import { categoryPhoto } from '../lib/categoryPhotos.js'
import { useDragScroll } from '../hooks/useDragScroll.js'
import { LEGAL_DOCS, LEGAL_ORDER, legalPath } from '../lib/legal.js'

gsap.registerPlugin(ScrollTrigger)

const steps = [
	{ kicker: 'Paso 01', title: 'Describe lo que necesitas', detail: 'Registra tu vehículo y publica una solicitud de repuestos con fotos y notas.' },
	{ kicker: 'Paso 02', title: 'Compara propuestas', detail: 'Las tiendas que atienden esa categoría responden con precio total, marca, disponibilidad y garantía.' },
	{ kicker: 'Paso 03', title: 'Confirma la atención', detail: 'Selecciona una tienda, recibe su ubicación, confirma la atención y deja tu reseña.' },
]

const benefits = [
	{ icon: 'requests', title: 'Una sola solicitud', text: 'Cuentas qué necesitas una vez y las tiendas que atienden esa categoría te responden.' },
	{ icon: 'proposal', title: 'Precios totales claros', text: 'Cada propuesta indica el precio total por la cantidad que pediste, junto con marca, disponibilidad y garantía.' },
	{ icon: 'store', title: 'Tiendas aprobadas', text: 'Solo las tiendas revisadas y activas pueden enviar propuestas y publicar promociones.' },
	{ icon: 'star', title: 'Reseñas verificadas', text: 'Solo quien confirmó la atención de una tienda puede calificarla.' },
]

// Texto que se «enciende» palabra por palabra con el scroll. `strong` = en azul.
const manifesto = [
	{ text: 'Pides tu repuesto' }, { text: 'una sola vez.', strong: true },
	{ text: 'Las tiendas responden con' }, { text: 'precio, marca y garantía.', strong: true },
	{ text: 'Tú' }, { text: 'eliges.', strong: true },
]
const manifestoWords = manifesto.flatMap((part, partIndex) => part.text.split(' ').map((word, wordIndex) => ({ word, strong: part.strong, key: `${partIndex}-${wordIndex}` })))

const dateFormat = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeZone: 'America/La_Paz' })

// Entrada del hero y parallax por capas. Corre una vez al montar.
function useHeroMotion(rootRef) {
	useLayoutEffect(() => {
		const root = rootRef.current
		if (!root) return undefined
		const context = gsap.context(() => {
			const media = gsap.matchMedia()
			media.add('(prefers-reduced-motion: no-preference)', () => {
				gsap.timeline({ defaults: { ease: 'power3.out' } })
					.from('.hero-word', { yPercent: 115, duration: 1, stagger: .06 })
					.from('[data-hero-fade]', { y: 24, opacity: 0, duration: .8, stagger: .1 }, '-=.6')
					.from('.hero-layer-chevrons', { xPercent: 12, opacity: 0, duration: 1.4 }, 0)
					.from('.hero-rotor', { scale: .75, opacity: 0, rotate: -60, duration: 1.4 }, .1)
					.from('.hero-card', { y: 50, opacity: 0, duration: .9, stagger: .12 }, .5)

				const scroll = { trigger: '.landing-hero', start: 'top top', end: 'bottom top', scrub: .5 }
				const parallax = gsap.timeline({ scrollTrigger: scroll, defaults: { ease: 'none' } })
				gsap.utils.toArray('.hero-scene [data-depth]', root).forEach((layer) => {
					parallax.to(layer, { yPercent: -36 * Number(layer.dataset.depth), force3D: true }, 0)
				})
				parallax
					.to('.hero-rotor', { rotate: 150 }, 0)
					.to('.hero-copy', { yPercent: -18, opacity: .15 }, 0)
			})
		}, root)
		return () => context.revert()
	}, [rootRef])
}

// Relatos con scroll: texto que se enciende, categorías en horizontal, freno que se arma,
// columnas desfasadas y apariciones. Se monta cuando los datos ya tienen su altura final.
function useStoryMotion(rootRef, ready) {
	useLayoutEffect(() => {
		const root = rootRef.current
		if (!root || !ready) return undefined
		const context = gsap.context(() => {
			const media = gsap.matchMedia()

			media.add('(prefers-reduced-motion: no-preference)', () => {
				gsap.fromTo('.manifesto-word', { '--fill': 0 }, {
					'--fill': 1, ease: 'none', stagger: .5,
					scrollTrigger: { trigger: '.landing-manifesto', start: 'top 72%', end: 'bottom 52%', scrub: .4 },
				})

				gsap.fromTo('.manifesto-chevrons', { xPercent: -20 }, { xPercent: 20, ease: 'none', scrollTrigger: { trigger: '.landing-manifesto', start: 'top bottom', end: 'bottom top', scrub: true } })

				gsap.fromTo('.final-chevrons', { yPercent: 25 }, { yPercent: -25, ease: 'none', scrollTrigger: { trigger: '.landing-final', start: 'top bottom', end: 'bottom top', scrub: true } })
				gsap.from('.landing-final h2', { scale: .9, opacity: .3, ease: 'none', scrollTrigger: { trigger: '.landing-final', start: 'top 90%', end: 'top 35%', scrub: true } })

				ScrollTrigger.batch('[data-reveal]', {
					start: 'top 90%',
					once: true,
					onEnter: (elements) => gsap.from(elements, { y: 40, opacity: 0, duration: .9, ease: 'power3.out', stagger: .08, overwrite: true }),
				})
			})

			media.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
				// Beneficios: la segunda columna se desliza más rápido que la primera.
				gsap.fromTo('.benefits-col-b', { yPercent: 10 }, { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.landing-benefits', start: 'top bottom', end: 'bottom top', scrub: true } })

				// Firma: el freno se arma mientras se recorren los tres pasos.
				const stepNodes = gsap.utils.toArray('.process-step', root)
				const fill = root.querySelector('.process-meter-fill')
				const setActive = (progress) => {
					const active = Math.min(stepNodes.length - 1, Math.floor(progress * stepNodes.length * .999))
					stepNodes.forEach((node, index) => node.classList.toggle('is-active', index === active))
					fill?.style.setProperty('--progress', progress.toFixed(3))
				}
				gsap.timeline({
					defaults: { ease: 'power2.inOut' },
					scrollTrigger: { trigger: '.process-section', start: 'top 75%', end: 'bottom 60%', scrub: .8, onUpdate: (self) => setActive(self.progress) },
				})
					.fromTo('.process-stage [data-part="rotor"]', { scale: .55, rotate: -120, opacity: .25, transformOrigin: '50% 50%' }, { scale: 1, rotate: 0, opacity: 1, duration: 1 })
					.fromTo('.process-stage [data-part="caliper"]', { x: 140, y: -150, rotate: 25, opacity: 0, transformOrigin: '75% 25%' }, { x: 0, y: 0, rotate: 0, opacity: 1, duration: 1 })
					.fromTo('.process-stage [data-part="pads"]', { x: 60, y: -70, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: .6 })
					.to('.process-stage [data-part="heat"]', { opacity: .75, duration: .4 })
					.to('.process-stage .brake-assembly', { rotate: 8, scale: 1.04, duration: .4 }, '<')
				setActive(0)
				return () => stepNodes.forEach((node) => node.classList.remove('is-active'))
			})
		}, root)
		ScrollTrigger.refresh()
		return () => context.revert()
	}, [rootRef, ready])
}

function Stars({ value }) {
	return <span className="landing-stars" role="img" aria-label={`${value} de 5 estrellas`}>{'★'.repeat(value)}<span aria-hidden="true">{'★'.repeat(5 - value)}</span></span>
}

function StoreRating({ summary, failed }) {
	if (failed) return <span>Reseñas no disponibles</span>
	const total = Number(summary?.total || 0)
	if (!total) return <span>Sin reseñas todavía</span>
	return <span><b className="landing-store-star">★ {Number(summary.promedio).toFixed(1)}</b> · {total} {total === 1 ? 'reseña' : 'reseñas'}</span>
}

function Home() {
	const { role, user } = useAuth()
	const signedIn = Boolean(user)
	const rootRef = useRef(null)
	const [categories, setCategories] = useState({ state: 'loading', items: [] })
	const [stores, setStores] = useState({ state: 'loading', items: [], summaries: {}, reviews: [], reviewsFailed: false })

	useEffect(() => {
		let active = true
		obtenerCategoriasActivas()
			.then((data) => { if (active) setCategories({ state: 'ready', items: data || [] }) })
			.catch(() => { if (active) setCategories({ state: 'error', items: [] }) })
		obtenerTiendasPublicas(0)
			.then(async ({ items }) => {
				const featured = items.slice(0, 6)
				let summaries = {}
				let reviews = []
				let reviewsFailed = false
				try {
					const result = await obtenerResenasPublicasDeTiendas(items.map((store) => store.id))
					summaries = result.summaries
					reviews = result.reviews
				} catch { reviewsFailed = true }
				if (active) setStores({ state: 'ready', items: featured, all: items, summaries, reviews, reviewsFailed })
			})
			.catch(() => { if (active) setStores({ state: 'error', items: [], summaries: {}, reviews: [], reviewsFailed: false }) })
		return () => { active = false }
	}, [])

	const categoryItems = landingCategories(categories.items)
	const ready = categories.state !== 'loading' && stores.state !== 'loading'
	useHeroMotion(rootRef)
	useStoryMotion(rootRef, ready)
	const categoriesRef = useRef(null)
	useDragScroll(categoriesRef, categoryItems.length > 0)
	const scrollCategories = (direction) => {
		const viewport = categoriesRef.current
		if (viewport) viewport.scrollBy({ left: direction * viewport.clientWidth * .8, behavior: 'smooth' })
	}

	const hero = heroActions(role, signedIn)
	const paths = finalPaths(role, signedIn)
	const storesById = new Map((stores.all || stores.items).map((store) => [store.id, store]))
	const reviews = featuredReviews(stores.reviews, storesById)
	const footerLinks = publicNavLinks(role, signedIn).filter((link) => !link.hash)

	return (
		<div className="public-home landing" ref={rootRef}>
			<a className="skip-link" href="#contenido">Ir al contenido</a>
			<Header overlay />
			<main id="contenido" tabIndex={-1}>

				{/* 1 · Hero (oscuro) */}
				<section className="landing-hero section-dark" aria-labelledby="hero-title">
					<HeroScene />
					<div className="hero-copy">
						<p className="eyebrow" data-hero-fade>DriveFix · Repuestos con propuestas</p>
						<h1 id="hero-title">
							<span className="hero-line"><span className="hero-word">El</span> <span className="hero-word">repuesto</span> <span className="hero-word">correcto,</span></span>{' '}
							<span className="hero-line hero-line-accent"><span className="hero-word">sin</span> <span className="hero-word">dar</span> <span className="hero-word">vueltas.</span></span>
						</h1>
						<p className="hero-text" data-hero-fade>Publica lo que necesita tu vehículo y recibe propuestas de tiendas aprobadas. Tú comparas y eliges.</p>
						<div className="hero-actions" data-hero-fade>
							<Link className="button button-primary button-lg" to={hero.primary.to}>{hero.primary.label} <span aria-hidden="true">→</span></Link>
							<Link className="button button-secondary button-lg" to={hero.secondary.to}>{hero.secondary.label}</Link>
						</div>
						{!signedIn && <p className="hero-note" data-hero-fade>Las promociones de las tiendas se ven al <Link to="/login">iniciar sesión</Link>.</p>}
					</div>
					<a className="hero-scroll" href="#manifiesto"><span>Desliza</span><i aria-hidden="true" /></a>
				</section>

				{/* 2 · Manifiesto (claro) */}
				<section id="manifiesto" className="landing-manifesto" aria-labelledby="manifesto-title">
					<svg className="manifesto-chevrons" viewBox="0 0 520 400" aria-hidden="true" focusable="false">
						<path d="M40 30l170 170L40 370" className="hero-chevron hero-chevron-signal" />
						<path d="M240 30l170 170-170 170" className="hero-chevron hero-chevron-highlight" />
					</svg>
					<p className="eyebrow">Así de simple</p>
					<h2 id="manifesto-title" className="manifesto-text">
						{manifestoWords.map((item) => <span key={item.key} className={`manifesto-word${item.strong ? ' is-strong' : ''}`}>{item.word} </span>)}
					</h2>
				</section>

				{/* 3 · Categorías (claro, fila horizontal que se arrastra) */}
				<section id="categorias" className="landing-categories" aria-labelledby="categorias-title">
					<div className="landing-heading">
						<div>
							<p className="eyebrow">Explora por categoría</p>
							<h2 id="categorias-title">La pieza correcta empieza aquí</h2>
						</div>
						<div className="landing-heading-aside">
							<p>
								{role === 'tienda' ? 'Elige las categorías que atiendes para recibir solicitudes.'
									: signedIn && role !== 'cliente' ? 'Categorías activas en DriveFix.'
									: 'Elige una categoría y publica tu solicitud en un minuto.'}
							</p>
							{categoryItems.length > 0 && <div className="categories-arrows">
								<button type="button" className="icon-action" onClick={() => scrollCategories(-1)} aria-label="Categorías anteriores">←</button>
								<button type="button" className="icon-action" onClick={() => scrollCategories(1)} aria-label="Más categorías">→</button>
							</div>}
						</div>
					</div>
					{categories.state === 'error' && <p className="request-history-notice" role="status">No se pudieron cargar las categorías. Puedes explorar las tiendas mientras tanto.</p>}
					{categories.state === 'loading' && <div className="categories-viewport"><div className="categories-track" role="status" aria-label="Cargando categorías…">{[0, 1, 2, 3].map((index) => <span className="category-card is-skeleton" key={index} />)}</div></div>}
					{categories.state === 'ready' && categoryItems.length === 0 && <p className="request-history-notice" role="status">Todavía no hay categorías activas.</p>}
					{categoryItems.length > 0 && <div className="categories-viewport" ref={categoriesRef}>
						<ul className="categories-track">
							{categoryItems.map((category, index) => {
								const link = categoryLink(role, signedIn, category.id)
								const body = <>
									<span className="category-card-index">{String(index + 1).padStart(2, '0')}</span>
									{categoryPhoto(category.nombre)
										? <span className="category-card-photo"><img src={categoryPhoto(category.nombre)} alt="" width="480" height="320" loading="lazy" decoding="async" draggable="false" /></span>
										: <span className="category-card-art"><CategoryGlyph name={category.nombre} /></span>}
									<strong>{category.nombre}</strong>
									{category.subcategorias > 0 && <span className="category-card-meta">{category.subcategorias} {category.subcategorias === 1 ? 'subcategoría' : 'subcategorías'}</span>}
									{link && <span className="category-card-action">{link.action} <span aria-hidden="true">→</span></span>}
								</>
								return <li key={category.id}>
									{link ? <Link className="category-card" to={link.to}>{body}</Link> : <div className="category-card">{body}</div>}
								</li>
							})}
						</ul>
					</div>}
				</section>

				{/* 4 · Cómo funciona (oscuro, contado con el scroll) */}
				<section id="como-funciona" className="process-section section-dark" aria-labelledby="process-title">
					<div className="process-pin">
						<div className="process-copy">
							<p className="eyebrow">Paso a paso</p>
							<h2 id="process-title">Cómo funciona DriveFix</h2>
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

				{/* 5 · Beneficios (claro, columnas desfasadas) */}
				<section className="landing-benefits" aria-labelledby="benefits-title">
					<div className="benefits-intro" data-reveal>
						<p className="eyebrow">Por qué DriveFix</p>
						<h2 id="benefits-title">Todo lo que necesitas para cuidar tu vehículo, en un solo lugar.</h2>
						<p>Sin llamar tienda por tienda ni comparar precios por partes: cada propuesta llega completa y ordenada.</p>
					</div>
					<div className="benefits-cols">
						{[benefits.slice(0, 2), benefits.slice(2)].map((column, columnIndex) => <div className={`benefits-col benefits-col-${columnIndex ? 'b' : 'a'}`} key={columnIndex}>
							{column.map((benefit) => <article className="benefit-card" key={benefit.title} data-reveal>
								<span className="benefit-icon"><Icon name={benefit.icon} size={24} /></span>
								<h3>{benefit.title}</h3>
								<p>{benefit.text}</p>
							</article>)}
						</div>)}
					</div>
				</section>

				{/* 6 · Tiendas y reseñas reales (claro) */}
				<section id="tiendas" className="landing-stores" aria-labelledby="stores-title">
					<div className="landing-heading" data-reveal>
						<div>
							<p className="eyebrow">Perfiles aprobados</p>
							<h2 id="stores-title">Tiendas reales, opiniones reales</h2>
						</div>
						<Link className="text-button" to={role === 'cliente' ? '/cliente/tiendas' : '/tiendas'}>Ver todas las tiendas →</Link>
					</div>
					{stores.state === 'loading' && <p className="request-loading" role="status">Cargando tiendas…</p>}
					{stores.state === 'error' && <p className="request-history-notice" role="status">No se pudieron cargar las tiendas. Vuelve a intentarlo más tarde.</p>}
					{stores.state === 'ready' && stores.items.length === 0 && <div className="landing-empty" data-reveal>
						<h3>Las primeras tiendas están en revisión</h3>
						<p>Cuando el equipo de DriveFix apruebe una tienda, aparecerá aquí con sus reseñas.</p>
					</div>}
					{stores.items.length > 0 && <ul className="landing-store-grid" data-count={stores.items.length}>
						{stores.items.map((store) => <li key={store.id} data-reveal>
							<Link className="landing-store-card" to={storeLink(role, store.id)}>
								<span className="landing-store-photo">
									{store.fotografias?.[0]
										? <img src={store.fotografias[0]} alt="" width="640" height="400" loading="lazy" decoding="async" />
										: <span className="landing-store-initial" aria-hidden="true">{store.nombre?.charAt(0)?.toUpperCase() || 'D'}</span>}
								</span>
								<span className="landing-store-text">
									<strong>{store.nombre}</strong>
									<span className="landing-store-meta"><StoreRating summary={stores.summaries[store.id]} failed={stores.reviewsFailed} /></span>
									{store.horario && <span className="landing-store-meta">{store.horario}</span>}
								</span>
							</Link>
						</li>)}
					</ul>}
					{reviews.length > 0 && <div className="landing-reviews">
						<h3 className="landing-reviews-title" data-reveal>Lo que dicen quienes ya fueron atendidos</h3>
						<ul className="landing-review-row">
							{reviews.map((review) => <li key={review.id} data-reveal>
								<figure className="landing-review">
									<Stars value={Number(review.calificacion) || 0} />
									<blockquote><p>{review.comentario}</p></blockquote>
									<figcaption>
										<span>Reseña de <strong>{review.tienda.nombre}</strong></span>
										<span>Atención confirmada · <time dateTime={review.fecha_creacion}>{dateFormat.format(new Date(review.fecha_creacion))}</time></span>
									</figcaption>
								</figure>
							</li>)}
						</ul>
					</div>}
				</section>

				{/* 7 · Llamada final (oscuro) */}
				<section className="landing-final section-dark" aria-labelledby="final-title">
					<svg className="final-chevrons" viewBox="0 0 520 400" aria-hidden="true" focusable="false">
						<path d="M40 30l170 170L40 370" className="hero-chevron hero-chevron-signal" />
						<path d="M240 30l170 170-170 170" className="hero-chevron hero-chevron-highlight" />
					</svg>
					<div className="landing-final-inner">
						<p className="eyebrow">El siguiente paso</p>
						<h2 id="final-title">Tu vehículo, en buenas manos.</h2>
						{(paths.client || paths.store) ? <div className="final-paths">
							{paths.client && <Link className="final-path" to={paths.client.to}>
								<span className="final-path-kicker">Necesito un repuesto</span>
								<strong>{paths.client.label}</strong>
								<span>Publica tu solicitud y recibe propuestas.</span>
								<span className="final-path-arrow" aria-hidden="true">→</span>
							</Link>}
							{paths.store && <Link className="final-path is-store" to={paths.store.to}>
								<span className="final-path-kicker">Tengo una tienda</span>
								<strong>{paths.store.label}</strong>
								<span>Responde a personas que ya buscan lo que vendes.</span>
								<span className="final-path-arrow" aria-hidden="true">→</span>
							</Link>}
						</div> : <Link className="button button-primary button-lg" to={hero.primary.to}>{hero.primary.label} <span aria-hidden="true">→</span></Link>}
					</div>
				</section>
			</main>

			<footer className="home-footer section-dark">
				<div className="home-footer-top">
					<Link className="brand" to="/" aria-label="DriveFix, inicio"><BrandLogo variant="dark" decorative /></Link>
					<p className="home-footer-tagline">Solicitudes de repuestos y propuestas de tiendas aprobadas.</p>
				</div>
				<nav aria-label="Enlaces del pie de página">
					<ul>
						{footerLinks.map((link) => <li key={link.to}><Link to={link.to}>{link.label}</Link></li>)}
						{!signedIn && <><li><Link to="/login">Iniciar sesión</Link></li><li><Link to="/register">Registrarse</Link></li></>}
					</ul>
				</nav>
				<nav className="home-footer-docs" aria-label="Documentos legales">
					<ul>{LEGAL_ORDER.map((key) => <li key={key}><Link to={legalPath(key)}>{LEGAL_DOCS[key].short}</Link></li>)}<li><Link to={legalPath('creditos')}>Créditos de imágenes</Link></li></ul>
				</nav>
				<p className="home-footer-legal">© {new Date().getFullYear()} DriveFix · Proyecto académico: algunas tiendas, reseñas y promociones son datos de demostración.</p>
			</footer>
		</div>
	)
}

export default Home
