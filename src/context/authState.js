import { createContext, useContext } from 'react'

export const AuthStateContext = createContext({ user: null, role: null, loading: true, profileError: '', signOut: () => {} })
export function useAuth() { return useContext(AuthStateContext) }
