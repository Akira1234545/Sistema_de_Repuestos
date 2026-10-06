import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../services/supabase.js'

const AuthStateContext = createContext({
	user: null,
	role: null,
	loading: true,
	signOut: () => {},
})

export function useAuth() {
	return useContext(AuthStateContext)
}

function AuthContext({ children }) {
	const [user, setUser] = useState(null)
	const [role, setRole] = useState(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
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
			setLoading(true)

			const { data, error } = await supabase
				.from('usuarios')
				.select('rol')
				.eq('id', sessionUser.id)
				.maybeSingle()

			if (mounted && currentRequestId === requestId) {
				setRole(error ? null : data?.rol ?? null)
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
		await supabase.auth.signOut()
		setUser(null)
		setRole(null)
	}

	return (
		<AuthStateContext.Provider value={{ user, role, loading, signOut }}>
			{children}
		</AuthStateContext.Provider>
	)
}

export default AuthContext
