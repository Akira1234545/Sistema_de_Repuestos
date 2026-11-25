import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ConfirmContext } from '../../context/confirmState.js'
import { useLayer } from '../../lib/layers.js'

// Diálogo de confirmación propio (sesión 8): sustituye a window.confirm para cerrar sesión
// y para las acciones que no se pueden deshacer. Es un <dialog> modal: el fondo queda inerte,
// el foco entra en «Cancelar» y vuelve al botón que lo abrió; Escape y el botón atrás cancelan.
export default function ConfirmProvider({ children }) {
	const [request, setRequest] = useState(null)
	const [text, setText] = useState('')
	const dialogRef = useRef(null)
	const cancelRef = useRef(null)
	const titleId = useId()
	const messageId = useId()

	const confirm = useCallback((options) => new Promise((resolve) => {
		setRequest((current) => {
			current?.resolve(false)
			return { ...options, resolve }
		})
		setText('')
	}), [])

	const finish = useCallback((answer) => {
		setRequest((current) => {
			current?.resolve(answer)
			return null
		})
	}, [])

	useLayer(Boolean(request), () => finish(false))

	useEffect(() => {
		const dialog = dialogRef.current
		if (!request || !dialog) return
		if (!dialog.open) dialog.showModal?.()
		cancelRef.current?.focus()
	}, [request])

	const danger = request?.tone === 'danger'
	// Sesión 8: con «input», el diálogo pide un texto (p. ej. el motivo de un bloqueo) y devuelve ese
	// texto en lugar de true. No deja confirmar con menos de minLength caracteres.
	const input = request?.input
	const minLength = input?.minLength ?? 10
	const textOk = !input || text.trim().length >= minLength
	const accept = () => { if (textOk) finish(input ? text.trim() : true) }
	return <ConfirmContext.Provider value={confirm}>
		{children}
		{request && <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby={titleId} aria-describedby={request.message ? messageId : undefined}
			onCancel={(event) => { event.preventDefault(); finish(false) }}
			onClick={(event) => { if (event.target === dialogRef.current) finish(false) }}>
			<div className="confirm-dialog-body">
				<h2 id={titleId}>{request.title}</h2>
				{request.message && <p id={messageId}>{request.message}</p>}
				{input && <label className="confirm-dialog-input">{input.label || 'Motivo'}
					<textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} maxLength={input.maxLength ?? 500}
						placeholder={input.placeholder || ''} required minLength={minLength} />
					<small>{text.trim().length < minLength ? `Escribe al menos ${minLength} caracteres. Se mostrará a la persona afectada.` : 'Se mostrará a la persona afectada.'}</small>
				</label>}
				<div className="confirm-dialog-actions">
					<button ref={cancelRef} type="button" className="button button-secondary" onClick={() => finish(false)}>{request.cancelLabel || 'Cancelar'}</button>
					<button type="button" className={danger ? 'button button-secondary is-danger' : 'button'} onClick={accept} disabled={!textOk}>{request.confirmLabel || 'Confirmar'}</button>
				</div>
			</div>
		</dialog>}
	</ConfirmContext.Provider>
}
