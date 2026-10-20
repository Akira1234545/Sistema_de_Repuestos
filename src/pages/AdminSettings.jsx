import { useCallback, useEffect, useState } from 'react'
import { guardarConfiguracionSistema, obtenerConfiguracionSistema } from '../services/adminService.js'

const initialSettings = {
	correo_soporte: '',
	telefono_soporte: '',
	mantenimiento_activo: false,
	mensaje_mantenimiento: 'El sistema está temporalmente en mantenimiento. Inténtalo más tarde.',
}

function AdminSettings() {
	const [settings, setSettings] = useState(initialSettings)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')

	const loadSettings = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			setSettings(await obtenerConfiguracionSistema())
		} catch (cause) {
			setError(`No se pudo cargar la configuración: ${cause.message}`)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		const timer = window.setTimeout(() => { void loadSettings() }, 0)
		return () => window.clearTimeout(timer)
	}, [loadSettings])

	function updateField(event) {
		const { name, value, checked, type } = event.target
		setSettings((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
	}

	async function saveSettings(event) {
		event.preventDefault()
		setSaving(true)
		setError('')
		setNotice('')
		try {
			await guardarConfiguracionSistema(settings)
			setNotice('La configuración se guardó correctamente.')
			await loadSettings()
		} catch (cause) {
			setError(`No se pudo guardar la configuración: ${cause.message}`)
		} finally {
			setSaving(false)
		}
	}

	return <section className="admin-panel" aria-labelledby="admin-settings-title">
		<div className="admin-section-heading"><div><p className="admin-kicker">PREFERENCIAS DE LA PLATAFORMA</p><h2 id="admin-settings-title">Configuración general</h2><p>Administra el contacto de soporte y el aviso de mantenimiento.</p></div><button type="button" className="button button-secondary" onClick={() => { void loadSettings() }} disabled={loading || saving}>Actualizar</button></div>
		{error && <p className="admin-alert" role="alert">{error}</p>}
		{notice && <p className="admin-notice" role="status">{notice}</p>}
		{loading ? <p role="status">Cargando configuración…</p> : <form className="admin-settings-form" onSubmit={saveSettings}>
			<fieldset disabled={saving}>
				<legend>Contacto y soporte</legend>
				<label>Correo de soporte<input type="email" name="correo_soporte" value={settings.correo_soporte || ''} onChange={updateField} maxLength="254" placeholder="soporte@ejemplo.com" /></label>
				<label>Teléfono de soporte<input type="tel" name="telefono_soporte" value={settings.telefono_soporte || ''} onChange={updateField} maxLength="40" placeholder="+591…" /></label>
			</fieldset>
			<fieldset disabled={saving}>
				<legend>Modo mantenimiento</legend>
				<label className="admin-maintenance-toggle"><input type="checkbox" name="mantenimiento_activo" checked={Boolean(settings.mantenimiento_activo)} onChange={updateField} /> Activar aviso de mantenimiento para usuarios no administrativos</label>
				<label>Mensaje visible<textarea name="mensaje_mantenimiento" value={settings.mensaje_mantenimiento || ''} onChange={updateField} required={Boolean(settings.mantenimiento_activo)} maxLength="500" rows="4" /></label>
				<p className="admin-maintenance-note">Durante el mantenimiento se conserva el acceso a la pantalla de inicio de sesión para que un administrador pueda volver a entrar. Esta pantalla no sustituye las políticas RLS de Supabase.</p>
			</fieldset>
			<button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar configuración'}</button>
		</form>}
	</section>
}

export default AdminSettings
