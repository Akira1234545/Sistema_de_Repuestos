import { loadEnv } from 'vite'
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env }
const failures = []
try {
  const url = new URL(env.VITE_SUPABASE_URL)
  if (url.protocol !== 'https:' || url.hostname === 'your-project.supabase.co') failures.push('Configura la URL HTTPS real de Supabase.')
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') failures.push('La URL de Supabase debe contener solo el origen, sin credenciales, rutas o parámetros.')
} catch { failures.push('Falta VITE_SUPABASE_URL válida.') }
const key = env.VITE_SUPABASE_ANON_KEY || ''
if (!key || key === 'your-publishable-or-anon-key') failures.push('Falta la clave pública de Supabase.')
if (key.startsWith('sb_secret_')) failures.push('Nunca publiques una clave secreta en VITE_SUPABASE_ANON_KEY.')
try {
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
  if (payload.role === 'service_role') failures.push('La clave service_role no puede usarse en el frontend.')
  else if (payload.role !== 'anon') failures.push('Usa una clave anon/publishable; no publiques un token de usuario.')
} catch { if (key && !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key)) failures.push('La clave no tiene formato anon/publishable válido.') }
const siteUrl = env.VITE_PUBLIC_SITE_URL || ''
if (siteUrl) {
  try { if (new URL(siteUrl).protocol !== 'https:') failures.push('VITE_PUBLIC_SITE_URL debe empezar con https://.') }
  catch { failures.push('VITE_PUBLIC_SITE_URL no es una dirección válida.') }
} else console.warn('Aviso: falta VITE_PUBLIC_SITE_URL; en la app Android las promociones se compartirán sin enlace.')
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1 }
else console.log('Formato de configuración pública validado. Falta comprobar su conexión real y el documento de producción.')
