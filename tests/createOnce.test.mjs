import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOnce } from '../src/services/createOnce.js'

function clientFor(existing, code = '23505') {
  return { from: () => ({
    insert: () => ({ select: () => ({ single: async () => ({ error: { code } }) }) }),
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing }) }) }) }),
  }) }
}
test('creation retries accept only the same owned payload, never overwrite changes', async () => {
  const payload = { id: 'one', usuario_id: 'owner', titulo: 'Frenos', cantidad: 2 }
  assert.equal(await createOnce(clientFor(payload), 'solicitudes', payload, '*'), payload)
  const dated = { ...payload, fecha_inicio: '2026-10-24T04:00:00.000Z' }
  const equivalent = { ...dated, cantidad: '2', fecha_inicio: '2026-10-24T00:00:00-04:00' }
  assert.equal(await createOnce(clientFor(equivalent), 'solicitudes', dated, '*'), equivalent)
  await assert.rejects(createOnce(clientFor({ ...payload, cantidad: 3 }), 'solicitudes', payload, '*'), /otros datos/)
  await assert.rejects(createOnce(clientFor(null), 'solicitudes', payload, '*'), error => error.code === '23505')
  await assert.rejects(createOnce(clientFor(null, '42501'), 'solicitudes', payload, '*'), error => error.code === '42501')
})
