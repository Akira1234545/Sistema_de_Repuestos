import { publicError } from '../../lib/errors.js'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../../services/supabase.js'

function Login() {
	const navigate = useNavigate()
	const location = useLocation()
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	async function handleSubmit(event) {
		event.preventDefault()
		setError('')
		if (!supabase) { setError('Supabase no está configurado. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'); return }
		setLoading(true)
		try {
		const formData = new FormData(event.currentTarget)
		const { data, error: signInError } = await supabase.auth.signInWithPassword({
			email: formData.get('email'),
			password: formData.get('password'),
		})

		if (signInError) {
			setError(publicError(signInError))
			setLoading(false)
			return
		}

		const { data: profile, error: profileError } = await supabase
			.from('usuarios')
			.select('rol, activo')
			.eq('id', data.user.id)
			.maybeSingle()

		if (profileError || !profile || !profile.activo || !['cliente', 'tienda', 'administrador', 'superAdministrador'].includes(profile.rol)) {
			await supabase.auth.signOut()
			setError(profileError ? `No se pudo leer el perfil: ${publicError(profileError)}` : profile && !profile.activo ? 'Tu cuenta está desactivada. Contacta al administrador del sistema.' : 'No se encontró un perfil o rol válido. Contacta al administrador del sistema.')
			setLoading(false)
			return
		}

		const target = location.state?.from
		const ownPanel = profile.rol === 'tienda' ? '/tienda' : profile.rol === 'cliente' ? '/cliente' : '/admin'
		const allowedTarget = typeof target === 'string' && !target.startsWith('//') &&
			(target.startsWith(`${ownPanel}/`) || target === ownPanel || (['cliente','tienda'].includes(profile.rol) && target.startsWith('/promociones')))
		navigate(allowedTarget ? target : ownPanel)
		setLoading(false)
		} catch {
			setError('No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.')
		} finally { setLoading(false) }
	}

	return (
		<main className="auth-page">
			<div className="auth-intro"><Link className="brand" to="/"><span>R</span>Repuestos<strong>Pro</strong></Link><p>Vuelve a poner tu vehículo en movimiento.</p></div>
			<form className="auth-card" onSubmit={handleSubmit}>
				<p className="eyebrow">Acceder</p><h1>Bienvenido de vuelta</h1><p className="auth-description">Ingresa para continuar con tu experiencia.</p>
				<label>Correo electrónico<input name="email" type="email" autoComplete="email" required placeholder="tu@correo.com" /></label>
				<label>Contraseña<input name="password" type="password" autoComplete="current-password" required placeholder="Tu contraseña" /></label>
				<p className="auth-links"><Link to="/forgot-password">Olvidé mi contraseña</Link><Link to="/resend-confirmation">Reenviar confirmación</Link></p>
				{error && <p className="auth-error" role="alert">{error}</p>}
				<button className="button button-primary" type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Iniciar sesión'}</button>
				<p className="auth-switch">¿Aún no tienes cuenta? <Link to="/register">Regístrate</Link></p>
			</form>
		</main>
	)
}

export default Login
