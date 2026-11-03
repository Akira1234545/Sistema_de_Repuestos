import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabase.js'
import { useAuth } from '../context/authState.js'

export default function AdminMfaGate({ children }) {
  const { user, signOut } = useAuth()
  const [verified, setVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [factorId, setFactorId] = useState('')
  const [enrollment, setEnrollment] = useState(null)
  const [error, setError] = useState('')
  const pendingEnrollment = useRef(null)
  const check = useCallback(async () => {
    const result = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (result.error) throw result.error
    const allowed = result.data.currentLevel === 'aal2'
    setVerified(allowed)
    if (!allowed) {
      const factors = await supabase.auth.mfa.listFactors()
      if (factors.error) throw factors.error
      setFactorId(factors.data.totp[0]?.id || pendingEnrollment.current?.id || '')
    }
  }, [])
  useEffect(() => {
    let active = true
    const refresh = () => { if (active) void check().catch(() => { if (active) { setVerified(false); setError('No se pudo comprobar el segundo factor. Reintenta.') } }).finally(() => { if (active) setLoading(false) }) }
    refresh()
    const onFocus = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onFocus)
    return () => { active = false; window.removeEventListener('focus', onFocus) }
  }, [check, user.id])
  async function enroll() {
    setBusy(true); setError('')
    try {
      if (enrollment) {
        const removed = await supabase.auth.mfa.unenroll({ factorId: enrollment.id })
        if (removed.error) throw removed.error
      }
      const result = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Administración ${crypto.randomUUID().slice(0, 8)}` })
      if (result.error) throw result.error
      pendingEnrollment.current = result.data
      setEnrollment(result.data); setFactorId(result.data.id)
    } catch { setError('No se pudo generar el segundo factor. Reintenta o contacta con el propietario del sistema.') }
    finally { setBusy(false) }
  }
  async function verify(event) {
    event.preventDefault()
    const code = new FormData(event.currentTarget).get('code')
    setBusy(true); setError('')
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
      if (result.error) throw result.error
      await check()
      pendingEnrollment.current = null
      setEnrollment(null)
    } catch { setError('Código incorrecto o vencido. Comprueba la hora de tu autenticador e inténtalo de nuevo.') }
    finally { setBusy(false) }
  }
  if (loading) return <p className="route-loading" role="status">Comprobando segundo factor…</p>
  if (verified) return children
  return <main className="route-message"><p className="eyebrow">Administración</p><h1>Verificación administrativa</h1><p>El panel requiere una contraseña y un código de tu aplicación autenticadora.</p>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {!factorId && <button className="button" type="button" disabled={busy} onClick={enroll}>Configurar autenticador</button>}
    {enrollment && <div><p>Escanea el QR con tu autenticador y guarda el acceso en un lugar seguro.</p><img src={enrollment.totp.qr_code} alt="QR para configurar el segundo factor" width="240" height="240" /><details><summary>Configurar manualmente</summary><code>{enrollment.totp.secret}</code></details></div>}
    {factorId && <form onSubmit={verify}><label>Código de seis dígitos<input name="code" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" required /></label><button className="button" type="submit" disabled={busy}>{busy ? 'Verificando…' : 'Verificar código'}</button></form>}
    <p><button type="button" className="button button-secondary" onClick={() => { void signOut() }}>Cerrar sesión</button></p>
  </main>
}
