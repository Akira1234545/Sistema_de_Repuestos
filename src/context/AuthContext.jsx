import { useEffect, useState } from 'react'
import { supabase, supabaseConfigError } from '../services/supabase.js'
import { AuthStateContext } from './authState.js'

function AuthContext({ children }) {
	const [user, setUser] = useState(null)
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
					setRole(null)
					setLoading(false)
				}
				return
			}

			setUser(sessionUser)
			setRole(null)
			setProfileError('')
			setLoading(true)

			const { data, error } = await supabase
				.from('usuarios')
				.select('rol')
				.eq('id', sessionUser.id)
				.maybeSingle()

			if (mounted && currentRequestId === requestId) {
				setRole(error ? null : data?.rol ?? null)
				setProfileError(error ? `No se pudo leer el perfil: ${error.message}` : !data?.rol ? 'Tu cuenta no tiene un perfil o rol asignado en public.usuarios.' : '')
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
		setRole(null)
	}

	return (
		<AuthStateContext.Provider value={{ user, role, loading, profileError, signOut }}>
			{children}
		</AuthStateContext.Provider>
	)
}

export default AuthContext
