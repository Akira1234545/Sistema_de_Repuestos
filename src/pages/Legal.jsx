import { Link, Navigate, useParams } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo.jsx'
import { LEGAL_DOCS, LEGAL_ORDER, LEGAL_UPDATED, legalPath } from '../lib/legal.js'
import credits from '../lib/imageCredits.json'

// Documentos legales públicos (sesión 8): términos, privacidad, cookies, condiciones para tiendas
// y derechos del consumidor. Se pueden leer sin cuenta.
function Legal() {
	const { slug } = useParams()
	const doc = LEGAL_DOCS[slug]
	if (!doc) return <Navigate to={legalPath('terminos')} replace />

	return <main className="legal-page">
		<header className="legal-top">
			<Link className="brand" to="/" aria-label="DriveFix, inicio"><BrandLogo /></Link>
			<Link className="text-button" to="/">Volver al inicio</Link>
		</header>
		<div className="legal-layout">
			<nav className="legal-nav" aria-label="Documentos legales">
				<p className="eyebrow">Legal y transparencia</p>
				<ul>
					{LEGAL_ORDER.map((key) => <li key={key}>
						<Link to={legalPath(key)} aria-current={key === slug ? 'page' : undefined}>{LEGAL_DOCS[key].short}</Link>
					</li>)}
				</ul>
			</nav>
			<article className="legal-doc">
				<p className="eyebrow">Vigente desde el {LEGAL_UPDATED}</p>
				<h1>{doc.title}</h1>
				<p className="legal-summary">{doc.summary}</p>
				{doc.sections.map((section) => <section key={section.heading}>
					<h2>{section.heading}</h2>
					{section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
				</section>)}
				{slug === 'creditos' && <section><h2>Fotos</h2><ul className='legal-credits'>{credits.map((item) => <li key={item.name}>
					<strong>{item.title}</strong> — {item.author} · <a href={item.licenseUrl || item.source} target='_blank' rel='noreferrer'>{item.license}</a> · <a href={item.source} target='_blank' rel='noreferrer'>Fuente</a>
				</li>)}</ul></section>}
			</article>
		</div>
	</main>
}

export default Legal
