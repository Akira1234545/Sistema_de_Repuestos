import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon.jsx'
import { useAuth } from '../context/authState.js'
import { publicError } from '../lib/errors.js'
import { PASSWORD_HINT, passwordIssue } from '../lib/password.js'
import { ROLE_LABELS } from '../lib/roles.js'
import { actualizarMiPerfil } from '../services/authService.js'
import { supabase } from '../services/supabase.js'


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

// Supabase requires the current password for this change and, when the session is
// older than 24 hours, a one-time code it emails to the user (reauthentication).
function PasswordForm() {
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [needsCode, setNeedsCode] = useState(false)

	async function submit(event) {
		event.preventDefault()
		const formElement = event.currentTarget
		const values = new FormData(formElement)
		const currentPassword = String(values.get('current') || '')
		const password = String(values.get('password') || '')
		const nonce = String(values.get('code') || '').trim()
		setError(''); setNotice('')
		if (!currentPassword) { setError('Escribe tu contraseña actual.'); return }
		const issue = passwordIssue(password)
		if (issue) { setError(issue); return }
		if (password !== values.get('confirmation')) { setError('Las contraseñas no coinciden.'); return }
		if (needsCode && !nonce) { setError('Escribe el código que te enviamos por correo.'); return }
		setSaving(true)
		try {
			const { error: cause } = await supabase.auth.updateUser({ password, current_password: currentPassword, ...(nonce ? { nonce } : {}) })
			if (cause) throw cause
			formElement.reset()
			setNeedsCode(false)
			setNotice('Contraseña actualizada. Úsala la próxima vez que inicies sesión.')
		} catch (cause) {
			if (cause?.code === 'reauthentication_needed') {
				const { error: sendError } = await supabase.auth.reauthenticate()
				if (sendError) { setError(`No se pudo enviar el código de verificación: ${publicError(sendError)}`); return }
				setNeedsCode(true)
				setNotice('Por seguridad te enviamos un código a tu correo. Escríbelo abajo y vuelve a pulsar «Actualizar contraseña».')
				return
			}
			setError(cause?.code === 'same_password' ? 'La nueva contraseña debe ser diferente de la actual.'
				: cause?.code === 'weak_password' ? 'La contraseña es demasiado débil. Combina mayúsculas, minúsculas, números y símbolos.'
				: cause?.code === 'current_password_mismatch' || cause?.code === 'current_password_required' ? 'La contraseña actual no es correcta.'
				: cause?.code === 'reauthentication_not_valid' ? 'El código no es válido o ya venció. Revisa tu correo e inténtalo de nuevo.'
				: `No se pudo cambiar la contraseña: ${publicError(cause)}`)
		} finally { setSaving(false) }
	}

	return <form className="store-form-card" onSubmit={submit} aria-labelledby="account-password-title">
		<div><p className="store-label">Seguridad</p><h2 id="account-password-title">Cambiar contraseña</h2></div>
		{error && <p className="store-error" role="alert">{error}</p>}
		{notice && <p className="store-success" role="status">{notice}</p>}
		<div className="store-form-grid">
			<label className="account-field-wide">Contraseña actual<input name="current" type="password" autoComplete="current-password" required /></label>
			<label>Nueva contraseña<input name="password" type="password" minLength={12} autoComplete="new-password" required /></label>
			<label>Repite la contraseña<input name="confirmation" type="password" minLength={12} autoComplete="new-password" required /></label>
			<p className="account-field-wide store-request-date">{PASSWORD_HINT}</p>
			{needsCode && <label className="account-field-wide">Código de verificación<input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} required /></label>}
		</div>
		<div className="store-form-actions"><button className="button button-secondary" type="submit" disabled={saving}>{saving ? 'Actualizando…' : 'Actualizar contraseña'}</button></div>
	</form>
}

function SignOutCard() {
	const { signOut } = useAuth()
	const navigate = useNavigate()
	const [leaving, setLeaving] = useState(false)
	async function leave() {
		setLeaving(true)
		if (await signOut()) navigate('/login', { replace: true })
		else setLeaving(false)
	}
	return <div className="store-form-card account-signout">
		<div><p className="store-label">Sesión</p><h2>Cerrar sesión en este dispositivo</h2></div>
		<button type="button" className="button button-secondary account-signout-button" onClick={leave} disabled={leaving}><Icon name="logout" size={18} /> {leaving ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
	</div>
}

export default function Cuenta() {
	const { user, profile, role } = useAuth()
	const fullName = [profile?.nombre, profile?.apellido].filter(Boolean).join(' ') || 'Tu cuenta'
	return <section className="store-page account-page">
		<header className="profile-hero">
			<div className="account-identity">
				<span className="client-avatar account-avatar" aria-hidden="true">{fullName.charAt(0).toUpperCase()}</span>
				<div><span className="profile-eyebrow">Mi cuenta · {ROLE_LABELS[role] || 'Usuario'}</span><h1>{fullName}</h1><p>{user?.email}</p></div>
			</div>
		</header>
		{profile ? <ProfileForm key={profile.id} /> : <p className="request-loading" role="status">Cargando tus datos…</p>}
		<PasswordForm />
		<SignOutCard />
	</section>
}
