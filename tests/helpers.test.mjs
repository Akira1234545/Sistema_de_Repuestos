import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBatchLookup } from '../src/lib/batchLookup.js'
import { publicError } from '../src/lib/errors.js'
import { boliviaDay, boliviaDateTimeInput, vehicleYearLimit, whatsappPhone } from '../src/lib/format.js'

test('Supabase missing-function errors explain the required schema action', () => {
  assert.match(publicError({ code: 'PGRST202' }), /migración correspondiente/u)
  assert.match(publicError({ code: 'unknown' }), /Comprueba tu conexión/u)
})

test('calendar filters use Bolivian days and phone formatting preserves countries', () => {
  assert.equal(boliviaDay('2026-10-24T02:00:00Z'), '2026-10-23')
  assert.equal(boliviaDay('invalid'), '')
  assert.equal(boliviaDateTimeInput('2026-10-24T04:00:00Z'), '2026-10-24T00:00')
  assert.equal(vehicleYearLimit(new Date('2027-01-01T02:00:00Z')),2027)
  assert.equal(whatsappPhone('+54 9 11 1234 5678'), '5491112345678')
  assert.equal(whatsappPhone('00591 71234567'), '59171234567')
  assert.equal(whatsappPhone('71234567'), '59171234567')
  assert.equal(whatsappPhone('abc'), '')
})
test('favorite lookups batch duplicates and isolate accounts', async () => {
  const calls = []
  const lookup = createBatchLookup(async (group, ids) => { calls.push([group, ids]); return new Set(group === 'one' ? ['a'] : []) })
  assert.deepEqual(await Promise.all([lookup('one', 'a'), lookup('one', 'a'), lookup('one', 'b'), lookup('two', 'a')]), [true, true, false, false])
  assert.equal(calls.length, 2)
  const failing = createBatchLookup(async () => { throw new Error('offline') })
  await assert.rejects(failing('one', 'a'), /offline/)
})

test('password checks mirror the Supabase policy and name what is missing', async () => {
  const { passwordIssue } = await import('../src/lib/password.js')
  assert.equal(passwordIssue('Corta1!'), 'Usa al menos 12 caracteres.')
  assert.equal(passwordIssue('solominusculas1!'), 'Añade al menos una mayúscula.')
  assert.equal(passwordIssue('SinNumerosNiSimbolos'), 'Añade al menos un número y un símbolo.')
  assert.equal(passwordIssue('Repuestos2026!'), '')
})
