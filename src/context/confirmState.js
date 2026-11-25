import { createContext, useContext } from 'react'

// Devuelve una función async: `if (!(await confirm({ title, message }))) return`.
// Sin proveedor (pruebas aisladas) cae en window.confirm.
export const ConfirmContext = createContext(async ({ title, message }) => window.confirm([title, message].filter(Boolean).join('\n\n')))

export function useConfirm() {
	return useContext(ConfirmContext)
}

// Mismo texto en todos los botones de «Cerrar sesión» (barra lateral, menú de cuenta, encabezado, cuenta y admin).
export const SIGN_OUT_CONFIRM = {
	title: '¿Cerrar sesión?',
	message: 'Tendrás que volver a iniciar sesión en este dispositivo para ver tu panel.',
	confirmLabel: 'Cerrar sesión',
	cancelLabel: 'Seguir conectado',
}
