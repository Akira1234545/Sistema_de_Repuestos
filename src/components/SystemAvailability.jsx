import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/authState.js'
import { supabase } from '../services/supabase.js'

function SystemAvailability({ children }) {
	const { role } = useAuth()
	const { pathname } = useLocation()
	const [status, setStatus] = useState({ loading: true, maintenance: false, message: '', supportEmail: '', supportPhone: '', error: '' })

	const loadStatus = useCallback(async () => {
		if (!supabase) {
			setStatus({ loading: false, maintenance: false, message: '', supportEmail: '', supportPhone: '', error: 'No se pudo comprobar la configuración de mantenimiento: Supabase no está configurado.' })
			return
		}
		try {
			const { data, error } = await supabase.rpc('sprint3_get_system_status')
			if (error) throw error
			const config = data?.[0]
			if (!config) throw new Error('La respuesta de estado del sistema está vacía.')
			setStatus({
				loading: false,
				maintenance: config.mantenimiento_activo,
				message: config.mensaje_mantenimiento,
				supportEmail: config.correo_soporte || '',
				supportPhone: config.telefono_soporte || '',
				error: '',
			})
		} catch (cause) {
			setStatus({
				loading: false,
				maintenance: false,
				message: '',
				supportEmail: '',
				supportPhone: '',
				error: `No se pudo comprobar la configuración de mantenimiento: ${cause.message}`,
			})
		}
	}, [])

	useEffect(() => {
		const initialLoad = window.setTimeout(() => { void loadStatus() }, 0)
		const interval = window.setInterval(() => { void loadStatus() }, 60000)
		const refreshOnFocus = () => { if (document.visibilityState === 'visible') void loadStatus() }
		window.addEventListener('focus', refreshOnFocus)
		return () => {
			window.clearTimeout(initialLoad)
			window.clearInterval(interval)
			window.removeEventListener('focus', refreshOnFocus)
		}
	}, [loadStatus])

	if (status.loading) return <main className="system-status-loading" role="status">Comprobando disponibilidad del sistema…</main>

	const administrativeRole = ['administrador', 'superAdministrador'].includes(role)
	if (status.maintenance && !administrativeRole && pathname !== '/login') {
		return <main className="system-maintenance-page">
			<div className="system-maintenance-card">
				<p className="system-maintenance-kicker">REPUESTOS PRO / AVISO</p>
				<h1>Sistema en mantenimiento</h1>
				<p>{status.message}</p>
				{status.supportEmail && <p>Soporte: <a href={`mailto:${status.supportEmail}`}>{status.supportEmail}</a></p>}
				{status.supportPhone && <p>Teléfono: <a href={`tel:${status.supportPhone}`}>{status.supportPhone}</a></p>}
				<a href="/login">Acceso administrativo</a>
			</div>
		</main>
	}

	return <>
		{status.error && <p className="system-status-warning" role="alert">{status.error} La aplicación seguirá disponible; el control de acceso a los datos continúa dependiendo de RLS en Supabase.</p>}
		{children}
	</>
}

export default SystemAvailability
