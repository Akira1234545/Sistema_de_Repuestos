import { Capacitor } from '@capacitor/core'

// True inside the Android app; false in any browser.
export const isNativeApp = Capacitor.isNativePlatform()

// Custom scheme registered in AndroidManifest.xml. Supabase Auth must list
// "com.repuestospro.app://auth/**" under Authentication → URL Configuration → Redirect URLs.
export const NATIVE_AUTH_URL = 'com.repuestospro.app://auth'

// Where Supabase Auth emails should send the user back to, per platform.
export function authRedirectUrl(path) {
	return isNativeApp ? `${NATIVE_AUTH_URL}${path}` : `${window.location.origin}${path}`
}
