import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ToastContext } from '../../context/toastState.js'

const DURATION = 5200
let nextId = 0

function ToastItem({ toast, onDismiss }) {
	const timer = useRef(null)
	const start = useCallback(() => { timer.current = window.setTimeout(() => onDismiss(toast.id), DURATION) }, [onDismiss, toast.id])
	const stop = () => window.clearTimeout(timer.current)
	useEffect(() => { start(); return stop }, [start])
	return <li className={`toast toast-${toast.tone}`} onMouseEnter={stop} onMouseLeave={start} onFocus={stop} onBlur={start}>
		<span className="toast-mark" aria-hidden="true">{toast.tone === 'error' ? '!' : toast.tone === 'success' ? '✓' : '•'}</span>
		<div className="toast-copy">
			<strong>{toast.title}</strong>
			{toast.description && <p>{toast.description}</p>}
			{toast.action && <Link to={toast.action.to} onClick={() => onDismiss(toast.id)}>{toast.action.label} →</Link>}
		</div>
		<button type="button" className="toast-close" aria-label="Cerrar aviso" onClick={() => onDismiss(toast.id)}>×</button>
	</li>
}

// Stacked, self-dismissing messages announced politely to screen readers.
export default function Toaster({ children }) {
	const [toasts, setToasts] = useState([])
	const dismiss = useCallback((id) => setToasts((current) => current.filter((item) => item.id !== id)), [])
	const toast = useCallback(({ title, description = '', tone = 'info', action = null }) => {
		const id = ++nextId
		setToasts((current) => [...current.slice(-3), { id, title, description, tone, action }])
		return id
	}, [])
	return <ToastContext.Provider value={toast}>
		{children}
		<ol className="toaster" aria-live="polite" aria-relevant="additions">
			{toasts.map((item) => <ToastItem key={item.id} toast={item} onDismiss={dismiss} />)}
		</ol>
	</ToastContext.Provider>
}
