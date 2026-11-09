import { Capacitor } from '@capacitor/core'

// True inside the Android app; false in any browser.
export const isNativeApp = Capacitor.isNativePlatform()

// Custom scheme registered in AndroidManifest.xml. Supabase Auth must list
// "com.drivefix.app://auth/**" under Authentication → URL Configuration → Redirect URLs.
export const NATIVE_AUTH_URL = 'com.drivefix.app://auth'

// Where Supabase Auth emails should send the user back to, per platform.
export function authRedirectUrl(path) {
	return isNativeApp ? `${NATIVE_AUTH_URL}${path}` : `${window.location.origin}${path}`
}

// Show a «Tomar foto» button only where the camera can be opened directly
// (the Android app or a touch device); on desktop it would just open the file picker.
export const canCapturePhoto = isNativeApp || (typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches))
