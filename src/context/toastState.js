import { createContext, useContext } from 'react'

export const ToastContext = createContext(() => {})

// toast({ title, description?, tone?: 'success' | 'error' | 'info', action?: { label, to } })
export function useToast() { return useContext(ToastContext) }
