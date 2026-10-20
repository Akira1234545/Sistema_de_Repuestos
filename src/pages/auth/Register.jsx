import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { supabase } from '../../services/supabase.js'
import { registrarCuenta } from '../../services/authService.js'
import './Auth.css'

function Register() {
	const [searchParams] = useSearchParams()
	const navigate = useNavigate()
	const requestedRole = searchParams.get('role')
	const role = ['cliente', 'tienda'].includes(requestedRole) ? requestedRole : null
	const [error, setError] = useState('')
	const [message, setMessage] = useState('')
	const [loading, setLoading] = useState(false)

	async function handleSubmit(event) {
		event.preventDefault()
		if (!role) { setError('Elige si deseas registrarte como Cliente o Tienda.'); return }
		if (!supabase) { setError('Supabase no está configurado. Revisa VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'); return }
		setError('')
		setMessage('')
		setLoading(true)
		const formData = new FormData(event.currentTarget)
		const password = formData.get('password')
		const confirmPassword = formData.get('confirmPassword')
		if (password !== confirmPassword) {
			setError('Las contraseñas no coinciden.')
			setLoading(false)
			return
		}
		const { data, error: signUpError } = await registrarCuenta({
			email: formData.get('email'), password,
			nombre: formData.get('name'), apellido: formData.get('apellido'),
			telefono: formData.get('telefono'), role,
		})

		if (signUpError) {
			setError(signUpError.message)
			setLoading(false)
			return
		}

		if (data.session && data.user) {
			navigate(role === 'tienda' ? '/tienda' : '/cliente')
		} else {
			setMessage('Revisa tu correo para confirmar la cuenta antes de iniciar sesión.')
		}
		setLoading(false)
	}

	return (
		<main className="auth-page">
			<div className="auth-intro"><Link className="brand" to="/"><span>R</span>Repuestos<strong>Pro</strong></Link><p>Un buen viaje empieza con la pieza correcta.</p></div>
			<form className="auth-card" onSubmit={handleSubmit}>
				<p className="eyebrow">Crear cuenta / {role || 'tipo de cuenta'}</p>
				<h1>Únete a RepuestosPro</h1>
				{!role && <p className="auth-error" role="alert">Selecciona primero el tipo de cuenta en <Link to="/register">Registro</Link>.</p>}
				<p className="auth-description">Crea tu cuenta para {role === 'tienda' ? 'ofrecer tus repuestos y hacer crecer tu tienda.' : 'encontrar repuestos para tu vehículo.'}</p>
				<label>Nombre<input name="name" type="text" required placeholder="Tu nombre" /></label>
				<label>Apellido<input name="apellido" type="text" required placeholder="Tu apellido" /></label>
				<label>Teléfono<input name="telefono" type="tel" placeholder="Tu teléfono" /></label>
				<label>Correo electrónico<input name="email" type="email" required placeholder="tu@correo.com" /></label>
				<label>Contraseña<input name="password" type="password" required minLength="6" autoComplete="new-password" placeholder="Mínimo 6 caracteres" /></label>
				<label>Confirmar contraseña<input name="confirmPassword" type="password" required minLength="6" autoComplete="new-password" placeholder="Repite tu contraseña" /></label>
				{error && <p className="auth-error" role="alert">{error}</p>}
				{message && <p className="auth-message" role="status">{message}</p>}
				<button className="button button-primary" type="submit" disabled={loading || !role}>{loading ? 'Creando cuenta...' : 'Crear cuenta'}</button>
				<p className="auth-switch">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
			</form>
		</main>
	)
}

export default Register
