import { supabase } from './supabase.js'

export async function catalogNames(catalog, ids) {
  const unique = [...new Set(ids.filter(Boolean))]
  const names = new Map()
  for (let offset = 0; offset < unique.length; offset += 100) {
    const { data, error } = await supabase.rpc('catalog_names', { p_catalog: catalog, p_ids: unique.slice(offset, offset + 100) })
    if (error) throw error
    for (const item of data) names.set(item.id, item.nombre)
  }
  return names
}
