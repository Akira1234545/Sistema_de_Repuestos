// A retry may follow a successful commit whose response was lost. Never upsert:
// a retry must not overwrite an existing record or accept changed requirements.
export async function createOnce(client, table, payload, columns, ownerField = 'usuario_id') {
  const result = await client.from(table).insert(payload).select(columns).single()
  if (!result.error) return result.data
  if (result.error.code !== '23505') throw result.error
  const existing = await client.from(table).select(columns).eq('id', payload.id).eq(ownerField, payload[ownerField]).maybeSingle()
  if (existing.error || !existing.data) throw result.error
  const same = Object.entries(payload).every(([key, value]) => {
    if (key === ownerField) return true
    if (typeof value === 'number') return Number.isFinite(value) && Number(existing.data[key]) === value
    if (key.startsWith('fecha_')) {
      const timestamp = new Date(value).getTime()
      return Number.isFinite(timestamp) && new Date(existing.data[key]).getTime() === timestamp
    }
    return (existing.data[key] ?? '') === (value ?? '')
  })
  if (!same) throw new Error('El registro ya se guardó con otros datos. Revisa tu listado antes de volver a crear uno.')
  return existing.data
}
