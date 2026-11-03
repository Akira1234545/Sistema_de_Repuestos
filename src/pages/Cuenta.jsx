import { useState } from 'react'
import { useAuth } from '../context/authState.js'
import { publicError } from '../lib/errors.js'
import { actualizarMiPerfil } from '../services/authService.js'
import { supabase } from '../services/supabase.js'

const roleLabels = { cliente: 'Cliente', tienda: 'Tienda', administrador: 'Administrador', superAdministrador: 'Superadministrador' }

function ProfileForm() {
	const { profile, retryProfile } = useAuth()
	const [form, setForm] = useState({ nombre: profile?.nombre || '', apellido: profile?.apellido || '', telefono: profile?.telefono || '' })
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')

	function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); setNotice('') }

	async function submit(event) {
		event.preventDefault()
		setError(''); setNotice('')
		if (!form.nombre.trim() || !form.apellido.trim()) { setError('El nombre y el apellido son obligatorios.'); return }
		setSaving(true)
		try {
			await actualizarMiPerfil(form)
			await retryProfile()
			setNotice('Tus datos se guardaron correctamente.')
		} catch (cause) { setError(`No se pudieron guardar tus datos: ${publicError(cause)}`) }
		finally { setSaving(false) }
	}

	return <form className="store-form-card" onSubmit={submit} aria-labelledby="account-data-title">
		<div><p className="store-label">Datos personales</p><h2 id="account-data-title">Cómo te ven las tiendas y el equipo de soporte</h2></div>
		{error && <p className="store-error" role="alert">{error}</p>}
		{notice && <p className="store-success" role="status">{notice}</p>}
		<div className="store-form-grid">
			<label>Nombre<input name="nombre" value={form.nombre} onChange={update} maxLength={100} autoComplete="given-name" required /></label>
			<label>Apellido<input name="apellido" value={form.apellido} onChange={update} maxLength={100} autoComplete="family-name" required /></label>
			<label className="store-field-full">Teléfono <small>Opcional · incluye el código de país si no es de Bolivia</small><input name="telefono" type="tel" value={form.telefono} onChange={update} maxLength={20} autoComplete="tel" placeholder="+591 70000000" /></label>
		</div>
		<div className="store-form-actions"><button className="button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar datos'}</button></div>
	</form>
}

function PasswordForm() {
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')

	async function submit(event) {
		event.preventDefault()
		const formElement = event.currentTarget
		const values = new FormData(formElement)
		const password = String(values.get('password') || '')
		setError(''); setNotice('')
		if (password.length < 12) { setError('Usa al menos 12 caracteres.'); return }
		if (password !== values.get('confirmation')) { setError('Las contraseñas no coinciden.'); return }
		setSaving(true)
		try {
			const { error: cause } = await supabase.auth.updateUser({ password })
			if (cause) throw cause
			formElement.reset()
			setNotice('Contraseña actualizada. Úsala la próxima vez que inicies sesión.')
		} catch (cause) {
			setError(cause?.code === 'same_password' ? 'La nueva contraseña debe ser diferente de la actual.'
				: cause?.code === 'weak_password' ? 'La contraseña es demasiado débil. Combina letras, números y símbolos.'
				: cause?.code === 'reauthentication_needed' ? 'Por seguridad, vuelve a iniciar sesión antes de cambiar la contraseña.'
				: `No se pudo cambiar la contraseña: ${publicError(cause)}`)
		} finally { setSaving(false) }
	}

	return <form className="store-form-card" onSubmit={submit} aria-labelledby="account-password-title">
		<div><p className="store-label">Seguridad</p><h2 id="account-password-title">Cambiar contraseña</h2></div>
		{error && <p className="store-error" role="alert">{error}</p>}
		{notice && <p className="store-success" role="status">{notice}</p>}
		<div className="store-form-grid">
			<label>Nueva contraseña<input name="password" type="password" minLength={12} autoComplete="new-password" required /></label>
			<label>Repite la contraseña<input name="confirmation" type="password" minLength={12} autoComplete="new-password" required /></label>
		</div>
		<div className="store-form-actions"><button className="button button-secondary" type="submit" disabled={saving}>{saving ? 'Actualizando…' : 'Actualizar contraseña'}</button></div>
	</form>
}

export default function Cuenta() {
	const { user, profile, role } = useAuth()
	const fullName = [profile?.nombre, profile?.apellido].filter(Boolean).join(' ') || 'Tu cuenta'
	return <section className="store-page account-page">
		<header className="profile-hero">
			<div className="account-identity">
				<span className="client-avatar account-avatar" aria-hidden="true">{fullName.charAt(0).toUpperCase()}</span>
				<div><span className="profile-eyebrow">Mi cuenta · {roleLabels[role] || 'Usuario'}</span><h1>{fullName}</h1><p>{user?.email}</p></div>
			</div>
		</header>
		{profile ? <ProfileForm key={profile.id} /> : <p className="request-loading" role="status">Cargando tus datos…</p>}
		<PasswordForm />
	</section>
}
