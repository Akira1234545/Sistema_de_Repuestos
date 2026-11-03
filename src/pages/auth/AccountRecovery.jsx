import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../services/supabase.js'
import { useAuth } from '../../context/authState.js'
import { authRedirectUrl } from '../../lib/platform.js'
import { publicError } from '../../lib/errors.js'
import { PASSWORD_HINT, passwordIssue } from '../../lib/password.js'

export default function AccountRecovery({ reset = false, confirmation = false }) {
  const { user, loading, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function submit(event) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setBusy(true); setError(''); setMessage('')
    try {
      if (!supabase) throw new Error('El servicio no está disponible. Contacta con soporte.')
      if (reset) {
        if (!user) throw new Error('El enlace venció. Solicita otro enlace de recuperación.')
        const password = values.get('password')
        const issue = passwordIssue(password)
        if (issue) throw new Error(issue)
        if (password !== values.get('confirmation')) throw new Error('Las contraseñas no coinciden.')
        const { error: cause } = await supabase.auth.updateUser({ password })
        if (cause) throw new Error(cause.code === 'weak_password' || cause.code === 'same_password' ? publicError(cause) : 'No se pudo cambiar la contraseña. Comprueba que el enlace siga vigente e inténtalo de nuevo.')
        const signedOut = await signOut()
        setMessage(signedOut ? 'Contraseña actualizada. Ya puedes iniciar sesión.' : 'Contraseña actualizada. Cierra tu sesión antes de continuar en un equipo compartido.')
      } else if (confirmation) {
        const { error: cause } = await supabase.auth.resend({
          type: 'signup', email: values.get('email').trim(),
          options: { emailRedirectTo: authRedirectUrl('/login') },
        })
        if (cause) throw new Error('No se pudo enviar el correo. Espera un momento e inténtalo de nuevo.')
        setMessage('Si la cuenta requiere confirmación, recibirás un correo con las instrucciones.')
      } else {
        const { error: cause } = await supabase.auth.resetPasswordForEmail(values.get('email').trim(), {
          redirectTo: authRedirectUrl('/reset-password'),
        })
        if (cause) throw new Error('No se pudo enviar el enlace. Espera un momento e inténtalo de nuevo.')
        setMessage('Si el correo está registrado, recibirás un enlace para recuperar tu cuenta.')
      }
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }
  return <main className="auth-page"><div className="auth-intro"><Link className="brand" to="/"><span aria-hidden="true">R</span>Repuestos<strong>Pro</strong></Link><p>Recupera el acceso a tu cuenta.</p></div>
    <form className="auth-card" onSubmit={submit}><p className="eyebrow">Tu cuenta</p><h1>{reset ? 'Nueva contraseña' : confirmation ? 'Confirmar correo' : 'Recuperar contraseña'}</h1>
      {reset ? <><label>Nueva contraseña<input name="password" type="password" minLength={12} autoComplete="new-password" required /></label><label>Repite la contraseña<input name="confirmation" type="password" minLength={12} autoComplete="new-password" required /></label><p>{PASSWORD_HINT}</p></> : <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>}
      {error && <p role="alert" className="auth-error">{error}</p>}{message && <p role="status" className="auth-message">{message}</p>}
      {!message && <button className="button" disabled={busy || (reset && loading)} type="submit">{busy ? 'Procesando…' : reset ? 'Guardar contraseña' : 'Enviar enlace'}</button>}
      {reset && !user && !loading && !message && <p><Link to="/forgot-password">Solicitar un nuevo enlace</Link></p>}
      <p><Link to="/login">Volver a iniciar sesión</Link></p>
    </form></main>
}
