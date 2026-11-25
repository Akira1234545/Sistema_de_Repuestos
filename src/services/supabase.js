import { createClient } from '@supabase/supabase-js'
import { isNativeApp } from '../lib/platform.js'
import { clearRecovery, markRecovery } from '../lib/recovery.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// The Android app receives auth links through a deep link, not the page URL, so it uses
// PKCE and exchanges the code itself (see NativeShell). Browsers keep the default flow.
const options = isNativeApp ? { auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true } } : undefined

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
// Para llamadas a Auth que no deben tocar la sesión guardada (prueba de passkey, ver lib/passkeyProof.js).
export const supabaseAuthEndpoint = supabaseConfigured ? `${supabaseUrl.replace(/\/+$/, '')}/auth/v1` : ''
export const supabasePublicKey = supabaseAnonKey || ''
export const supabase = supabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey, options) : null
// E18: se escucha desde la creación del cliente para no perder el PASSWORD_RECOVERY inicial
// (en la web llega al leer la URL; en la app, al canjear el código del enlace profundo).
supabase?.auth.onAuthStateChange((event, session) => {
	if (event === 'PASSWORD_RECOVERY') markRecovery(session?.user?.id)
	else if (event === 'SIGNED_OUT') clearRecovery()
})
export const supabaseConfigError = 'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env para conectar con Supabase.'
