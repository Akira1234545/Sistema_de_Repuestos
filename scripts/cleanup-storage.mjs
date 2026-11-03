// Server-only operation. Dry run unless --execute is explicitly supplied.
import { createClient } from '@supabase/supabase-js'
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY solo en el servidor de limpieza.')
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const execute = process.argv.includes('--execute')
const { data: jobs, error } = execute
  ? await client.rpc('claim_storage_cleanup', { p_limit: 100 })
  : await client.from('storage_cleanup_jobs').select('id,path').order('created_at').limit(100)
if (error) throw new Error('No se pudieron consultar las tareas de limpieza.')
console.log(`${jobs.length} tareas encontradas. Modo ${execute ? 'ejecución' : 'simulación'}.`)
if (execute) {
  for (const job of jobs) {
    // The claim prevents reattaching this path until removal is reconciled.
    const result = await client.storage.from('tiendas').remove([job.path])
    if (result.error) { console.error('No se pudo limpiar una tarea; se conserva para reintento.'); continue }
    const completed = await client.from('storage_cleanup_jobs').delete().eq('id', job.id)
    if (completed.error) console.error('Archivo retirado; la tarea se conserva para reconciliar en el próximo intento.')
  }
}
