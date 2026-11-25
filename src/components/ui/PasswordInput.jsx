import { useState } from 'react'

// Campo de contraseña con botón «ojo» para mostrarla u ocultarla (sesión 8).
// Recibe las mismas props que un <input>; el botón no envía el formulario.
export default function PasswordInput(props) {
	const [visible, setVisible] = useState(false)
	return <span className="password-field">
		<input {...props} type={visible ? 'text' : 'password'} />
		<button type="button" className="password-toggle" onClick={() => setVisible((value) => !value)}
			aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}
			title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
			<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
				<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
				<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
				{visible && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
			</svg>
		</button>
	</span>
}
