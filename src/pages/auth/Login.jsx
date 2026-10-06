import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../../services/supabase.js'
import './Auth.css'

function Login() {
	const navigate = useNavigate()
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	async function handleSubmit(event) {
		event.preventDefault()
		setError('')
		setLoading(true)
		const formData = new FormData(event.currentTarget)
		const { data, error: signInError } = await supabase.auth.signInWithPassword({
			email: formData.get('email'),
			password: formData.get('password'),
		})

		if (signInError) {
			setError(signInError.message)
			setLoading(false)
			return
		}

		const { data: profile, error: profileError } = await supabase
			.from('usuarios')
			.select('rol')
			.eq('id', data.user.id)
			.maybeSingle()

		if (profileError || !profile || !['cliente', 'tienda'].includes(profile.rol)) {
			await supabase.auth.signOut()
			setError('No se encontró un perfil válido. Contacta al administrador del sistema.')
			setLoading(false)
			return
		}

		navigate(profile.rol === 'tienda' ? '/tienda' : '/cliente')
		setLoading(false)
	}

	return (
		<main className="auth-page">
			<div className="auth-intro"><Link className="brand" to="/"><span>R</span>Repuestos<strong>Pro</strong></Link><p>Vuelve a poner tu vehículo en movimiento.</p></div>
			<form className="auth-card" onSubmit={handleSubmit}>
				<p className="eyebrow">Acceder</p><h1>Bienvenido de vuelta</h1><p className="auth-description">Ingresa para continuar con tu experiencia.</p>
				<label>Correo electrónico<input name="email" type="email" required placeholder="tu@correo.com" /></label>
				<label>Contraseña<input name="password" type="password" required placeholder="Tu contraseña" /></label>
				{error && <p className="auth-error" role="alert">{error}</p>}
				<button className="button button-primary" type="submit" disabled={loading}>{loading ? 'Ingresando...' : 'Iniciar sesión'}</button>
				<p className="auth-switch">¿Aún no tienes cuenta? <Link to="/register">Regístrate</Link></p>
			</form>
		</main>
	)
}

export default Login
