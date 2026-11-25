import { createContext, useContext } from 'react'

// reverify(motivo) → Promise<boolean>: true si la sesión ya tiene una verificación reciente o la
// persona la confirma con huella, passkey o código; false si cancela.
export const ReverifyContext = createContext(async () => true)
export const useReverify = () => useContext(ReverifyContext)
