import { publicError } from '../lib/errors.js'
import { isAccountGoneError, isDefinitiveAuthError } from '../lib/authErrors.js'
import { useEffect, useRef, useState } from 'react'
import { clearFormDrafts } from '../lib/formDrafts.js'
import { supabase, supabaseConfigError } from '../services/supabase.js'
import { obtenerPerfilAutenticado } from '../services/authService.js'
import { AuthStateContext } from './authState.js'

function AuthContext({ children }) {
	const [user, setUser] = useState(null)
	const [profile, setProfile] = useState(null)
	const [role, setRole] = useState(null)
	const [loading, setLoading] = useState(Boolean(supabase))
	const [profileError, setProfileError] = useState(supabase ? '' : supabaseConfigError)
	const validatedIdentity = useRef(null)
	const sessionIdentity = useRef(null)

	useEffect(() => {
		if (!supabase) return
		let mounted = true
		let requestId = 0
		let authRevision = 0

		async function applySession(session) {
			const currentRequestId = ++requestId
			const sessionUser = session?.user ?? null
			sessionIdentity.current = sessionUser?.id || null
			if (validatedIdentity.current && validatedIdentity.current === sessionUser?.id) {
				setUser(sessionUser)
				return
			}
			if (validatedIdentity.current && validatedIdentity.current !== sessionUser?.id) clearFormDrafts({ all: true })

			if (!sessionUser) {
				if (mounted) {
					setUser(null)
					setProfile(null)
					setRole(null)
					setLoading(false)
					validatedIdentity.current = null
				}
				return
			}

			setUser(sessionUser)
			setProfile(null)
			setRole(null)
			setProfileError('')
			setLoading(true)

			let loadedProfile = null
			let error = null
			try { loadedProfile = await obtenerPerfilAutenticado(sessionUser.id) }
			catch (profileLoadError) { error = profileLoadError }

			if (mounted && currentRequestId === requestId) {
				setProfile(loadedProfile)
				validatedIdentity.current = loadedProfile ? sessionUser.id : null
				setRole(loadedProfile?.rol ?? null)
				setProfileError(error ? `No se pudo validar tu perfil: ${publicError(error)}` : '')
				setLoading(false)
			}
		}

		supabase.auth.getSession().then(({ data: { session }, error }) => {
			if (error) throw error
			if (mounted && authRevision === 0) applySession(session)
		}).catch(() => {
			if (mounted) { setProfileError('No se pudo recuperar tu sesión. Recarga la página para reintentar.'); setLoading(false) }
		})

		const { data: { subscription } } = supabase.auth.onAuthStateChange(
			(_event, session) => {
				const revision = ++authRevision
				sessionIdentity.current = session?.user?.id || null
				if (mounted) setTimeout(() => { if (mounted && revision === authRevision) void applySession(session) }, 0)
			},
		)

		return () => {
			mounted = false
			subscription.unsubscribe()
		}
	}, [])

	useEffect(() => {
		if (!supabase || !user?.id || loading) return undefined
		const userId = user.id
		let mounted = true
		let checking = false

		async function revalidateAccount() {
			if (checking) return
			checking = true
			try {
				const { data: { session }, error: sessionError } = await supabase.auth.getSession()
				if (sessionError) throw sessionError
				if (!session?.user || session.user.id !== userId) return
				const refreshedProfile = await obtenerPerfilAutenticado(userId)
				if (mounted) {
					setProfile(refreshedProfile)
					setRole(refreshedProfile.rol)
					setProfileError('')
				}
			} catch (cause) {
				if (!mounted) return
				if (!isDefinitiveAuthError(cause)) {
					// Corte de red o fallo temporal: se mantiene el rol para no desmontar la página
					// ni perder lo que el usuario estaba escribiendo. Se reintenta en el próximo ciclo.
					setProfileError('No pudimos comprobar tu cuenta por un problema de conexión. Puedes seguir trabajando; lo volveremos a intentar.')
					return
				}
				setRole(null)
				setProfileError(`No se pudo revalidar tu cuenta: ${publicError(cause)}`)
				if (isAccountGoneError(cause)) {
					await supabase.auth.signOut()
					if (mounted) {
						setUser(null)
						setProfile(null)
						setRole(null)
					}
				}
			} finally {
				checking = false
			}
		}

		const interval = window.setInterval(() => { void revalidateAccount() }, 60000)
		const refreshOnFocus = () => { if (document.visibilityState === 'visible') void revalidateAccount() }
		window.addEventListener('focus', refreshOnFocus)
		return () => {
			mounted = false
			window.clearInterval(interval)
			window.removeEventListener('focus', refreshOnFocus)
		}
	}, [loading, user?.id])

	async function signOut() {
		if (supabase) {
			const { error } = await supabase.auth.signOut({ scope: 'local' })
			if (error) { setProfileError('No se pudo cerrar la sesión. Vuelve a intentarlo.'); return false }
		}
		clearFormDrafts({ all: true })
		validatedIdentity.current = null
		setUser(null)
		setProfile(null)
		setRole(null)
		setProfileError('')
		return true
	}
	async function retryProfile() {
		if (!user?.id) return
		try {
			const next = await obtenerPerfilAutenticado(user.id)
			if (sessionIdentity.current !== user.id) return
			setProfile(next); setRole(next.rol); setProfileError(''); validatedIdentity.current = user.id
		} catch { setProfileError('No se pudo validar tu cuenta. Reintenta o vuelve a iniciar sesión.') }
	}

	return (
		<AuthStateContext.Provider value={{ user, profile, role, loading, profileError, signOut, retryProfile }}>
			{children}
		</AuthStateContext.Provider>
	)
}

export default AuthContext
