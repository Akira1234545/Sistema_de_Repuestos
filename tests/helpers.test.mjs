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

test('business errors raised by the database reach the user, internal ones stay hidden', () => {
  assert.equal(publicError({ code: 'P0001', message: 'Filtros no válidos' }), 'Filtros no válidos')
  assert.equal(publicError({ code: 'P0001', message: 'Esta propuesta ya no se puede retirar' }), 'Esta propuesta ya no se puede retirar')
  assert.equal(publicError({ code: '22023', message: 'El nombre no puede superar 80 caracteres' }), 'El nombre no puede superar 80 caracteres')
  assert.match(publicError({ code: 'P0001', message: 'x'.repeat(241) }), /Comprueba tu conexión/u)
  assert.match(publicError({ code: 'P0001', message: 'permission denied for table usuarios' }), /Comprueba tu conexión/u)
  assert.match(publicError({ code: '42P01', message: 'relation "public.x" does not exist' }), /Comprueba tu conexión/u)
  assert.match(publicError({ code: '23503', message: 'Filtros no válidos' }), /Comprueba tu conexión/u)
  assert.match(publicError(new TypeError('Failed to fetch')), /Comprueba tu conexión/u)
})

test('account revalidation only drops the role on definitive errors', async () => {
  const { isAccountGoneError, isDefinitiveAuthError } = await import('../src/lib/authErrors.js')
  assert.equal(isDefinitiveAuthError(new TypeError('Failed to fetch')), false)
  assert.equal(isDefinitiveAuthError({ message: 'FetchError: network timeout', code: '' }), false)
  assert.equal(isDefinitiveAuthError({ status: 503, message: 'Service Unavailable' }), false)
  assert.equal(isDefinitiveAuthError({ status: 0, message: 'AuthRetryableFetchError' }), false)
  assert.equal(isDefinitiveAuthError(new Error('Tu cuenta está desactivada. Contacta al administrador del sistema.')), true)
  assert.equal(isDefinitiveAuthError(new Error('No existe un perfil asociado en public.usuarios.')), true)
  assert.equal(isDefinitiveAuthError({ status: 401, message: 'JWT expired' }), true)
  assert.equal(isDefinitiveAuthError({ status: 403, message: 'Forbidden' }), true)
  assert.equal(isDefinitiveAuthError({ code: 'PGRST301', message: 'JWT expired' }), true)
  assert.equal(isDefinitiveAuthError({ code: 'refresh_token_not_found', message: 'Invalid Refresh Token' }), true)
  assert.equal(isAccountGoneError({ status: 401 }), false)
})

test('only public photos of this Supabase project are shown to other users', async () => {
  const { isProjectPhotoUrl } = await import('../src/lib/storageUrls.js')
  const project = 'https://abc.supabase.co'
  assert.equal(isProjectPhotoUrl('https://abc.supabase.co/storage/v1/object/public/vehiculos/u1/p.webp', project, 'vehiculos'), true)
  assert.equal(isProjectPhotoUrl('https://evil.example/storage/v1/object/public/vehiculos/u1/p.webp', project, 'vehiculos'), false)
  assert.equal(isProjectPhotoUrl('http://abc.supabase.co/storage/v1/object/public/vehiculos/u1/p.webp', project, 'vehiculos'), false)
  assert.equal(isProjectPhotoUrl('https://abc.supabase.co/storage/v1/object/public/tiendas/u1/p.webp', project, 'vehiculos'), false)
  assert.equal(isProjectPhotoUrl('javascript:alert(1)', project, 'vehiculos'), false)
  assert.equal(isProjectPhotoUrl('https://abc.supabase.co.evil.example/storage/v1/object/public/vehiculos/u1/p.webp', project, 'vehiculos'), false)
  assert.equal(isProjectPhotoUrl('https://abc.supabase.co/storage/v1/object/public/vehiculos/u1/p.webp', '', 'vehiculos'), false)
})
