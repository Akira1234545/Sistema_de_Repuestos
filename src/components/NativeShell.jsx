import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Keyboard } from '@capacitor/keyboard'
import { Network } from '@capacitor/network'
import { SplashScreen } from '@capacitor/splash-screen'
import { useAuth } from '../context/authState.js'
import { isNativeApp } from '../lib/platform.js'
import { panelPath } from '../lib/roles.js'
import { supabase } from '../services/supabase.js'
import PullToRefresh from './PullToRefresh.jsx'

// Screens where the Android back button leaves the app instead of navigating back.
const ROOT_PATHS = new Set(['/', '/login', '/cliente', '/tienda', '/admin'])

// Completes a Supabase Auth email link (confirmation or password recovery) that
// arrived as com.drivefix.app://auth/<path>?code=… and returns the in-app path.
async function completeAuthLink(rawUrl) {
	const url = new URL(rawUrl)
	const path = url.pathname && url.pathname !== '/' ? url.pathname : '/login'
	const hash = new URLSearchParams(url.hash.slice(1))
	const failure = url.searchParams.get('error_description') || hash.get('error_description')
	if (failure) return { path, error: 'El enlace venció o ya se usó. Solicita uno nuevo.' }
	const code = url.searchParams.get('code')
	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code)
		if (error) return { path, error: 'No se pudo validar el enlace. Solicita uno nuevo desde la app.' }
	} else if (hash.get('access_token') && hash.get('refresh_token')) {
		const { error } = await supabase.auth.setSession({ access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token') })
		if (error) return { path, error: 'No se pudo validar el enlace. Solicita uno nuevo desde la app.' }
	}
	return { path }
}

function NativeBridge() {
	const navigate = useNavigate()
	const { pathname } = useLocation()
	const { user, role, loading } = useAuth()
	const [offline, setOffline] = useState(false)
	const pathRef = useRef(pathname)
	useEffect(() => { pathRef.current = pathname }, [pathname])

	// One-time native wiring.
	useEffect(() => {
		document.documentElement.classList.add('native-app')
		const handles = []
		const keep = (promise) => promise.then((handle) => handles.push(handle)).catch(() => {})

		keep(CapacitorApp.addListener('backButton', ({ canGoBack }) => {
			if (document.querySelector('.notification-popover')) {
				document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
				return
			}
			if (ROOT_PATHS.has(pathRef.current) || !canGoBack) void CapacitorApp.minimizeApp()
			else window.history.back()
		}))

		keep(CapacitorApp.addListener('appUrlOpen', ({ url }) => {
			if (!url?.startsWith('com.drivefix.app://') || !supabase) return
			void completeAuthLink(url).then(({ path, error }) => navigate(path, { replace: true, state: error ? { authLinkError: error } : undefined }))
		}))

		// Refresh tokens only while the app is in the foreground, as Supabase recommends for mobile.
		keep(CapacitorApp.addListener('appStateChange', ({ isActive }) => {
			if (!supabase) return
			if (isActive) void supabase.auth.startAutoRefresh()
			else void supabase.auth.stopAutoRefresh()
		}))

		void Network.getStatus().then((status) => setOffline(!status.connected)).catch(() => {})
		keep(Network.addListener('networkStatusChange', (status) => setOffline(!status.connected)))

		keep(Keyboard.addListener('keyboardWillShow', () => document.documentElement.classList.add('keyboard-open')))
		keep(Keyboard.addListener('keyboardWillHide', () => document.documentElement.classList.remove('keyboard-open')))

		// Light tactile feedback on primary navigation and primary actions.
		function onTap(event) {
			if (event.target.closest('.client-navigation-link, .store-navigation-link, .admin-tabs button, .button:not(:disabled)')) {
				void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
			}
		}
		document.addEventListener('click', onTap, { passive: true })

		return () => {
			document.removeEventListener('click', onTap)
			handles.forEach((handle) => handle.remove())
		}
	}, [navigate])

	// Hide the native splash once the session check has settled, so the first visible
	// frame is the right screen instead of a loading message.
	useEffect(() => {
		if (!loading) void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {})
	}, [loading])

	// The app opens straight into the user's panel; the marketing landing is for the web.
	useEffect(() => {
		if (loading) return
		if (pathname === '/') navigate(user && role ? panelPath(role) : '/login', { replace: true })
	}, [loading, navigate, pathname, role, user])

	return <>
		<PullToRefresh />
		{offline && <p className="native-offline" role="status">Sin conexión. Revisa tu red; los cambios no se guardarán hasta que vuelvas a conectarte.</p>}
	</>
}

export default function NativeShell() {
	return isNativeApp ? <NativeBridge /> : null
}
