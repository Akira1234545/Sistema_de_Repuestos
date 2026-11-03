import { createClient } from '@supabase/supabase-js'
import { isNativeApp } from '../lib/platform.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// The Android app receives auth links through a deep link, not the page URL, so it uses
// PKCE and exchanges the code itself (see NativeShell). Browsers keep the default flow.
const options = isNativeApp ? { auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true } } : undefined

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = supabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey, options) : null
export const supabaseConfigError = 'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env para conectar con Supabase.'
