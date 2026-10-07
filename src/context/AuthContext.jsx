import { useEffect, useState } from 'react'
import { supabase, supabaseConfigError } from '../services/supabase.js'
import { obtenerPerfilAutenticado } from '../services/authService.js'
import { AuthStateContext } from './authState.js'

function AuthContext({ children }) {
	const [user, setUser] = useState(null)
	const [profile, setProfile] = useState(null)
	const [role, setRole] = useState(null)
	const [loading, setLoading] = useState(Boolean(supabase))
	const [profileError, setProfileError] = useState(supabase ? '' : supabaseConfigError)

	useEffect(() => {
		if (!supabase) return
		let mounted = true
		let requestId = 0

		async function applySession(session) {
			const currentRequestId = ++requestId
			const sessionUser = session?.user ?? null

			if (!sessionUser) {
				if (mounted) {
					setUser(null)
					setProfile(null)
					setRole(null)
					setLoading(false)
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
				setRole(loadedProfile?.rol ?? null)
				setProfileError(error ? `No se pudo validar tu perfil: ${error.message}` : '')
				setLoading(false)
			}
		}

		supabase.auth.getSession().then(({ data: { session } }) => {
			if (mounted) applySession(session)
		})

		const { data: { subscription } } = supabase.auth.onAuthStateChange(
			(_event, session) => {
				if (mounted) setTimeout(() => applySession(session), 0)
			},
		)

		return () => {
			mounted = false
			subscription.unsubscribe()
		}
	}, [])

	async function signOut() {
		if (supabase) await supabase.auth.signOut()
		setUser(null)
		setProfile(null)
		setRole(null)
		setProfileError('')
	}

	return (
		<AuthStateContext.Provider value={{ user, profile, role, loading, profileError, signOut }}>
			{children}
		</AuthStateContext.Provider>
	)
}

export default AuthContext
