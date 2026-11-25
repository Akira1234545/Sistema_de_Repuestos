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

test('landing links follow the role (E23): no protected routes for visitors or other roles', async () => {
  const { categoryLink, finalPaths, heroActions, landingCategories, publicNavLinks, storeLink, featuredReviews } = await import('../src/lib/publicNav.js')
  const paths = (role, signedIn) => publicNavLinks(role, signedIn).map((link) => link.to)
  assert.ok(!paths(null, false).includes('/promociones'))
  assert.ok(!paths(null, false).some((to) => /^\/(cliente|tienda)(\/|$)/.test(to)))
  assert.ok(paths('cliente', true).includes('/promociones') && paths('cliente', true).includes('/cliente'))
  assert.ok(paths('tienda', true).includes('/promociones') && paths('tienda', true).includes('/tienda'))
  assert.ok(!paths('administrador', true).includes('/promociones') && paths('superAdministrador', true).includes('/admin'))
  assert.equal(categoryLink(null, false, 'c1').to, '/register?role=cliente')
  assert.equal(categoryLink('cliente', true, 'c1').to, '/cliente/solicitudes/crear?categoria=c1')
  assert.equal(categoryLink('tienda', true, 'c1').to, '/tienda/categorias')
  assert.equal(categoryLink('administrador', true, 'c1'), null)
  assert.equal(heroActions('tienda', true).primary.to, '/tienda/solicitudes')
  assert.equal(heroActions('administrador', true).primary.to, '/admin')
  assert.deepEqual(finalPaths('administrador', true), { client: null, store: null })
  assert.equal(finalPaths('tienda', true).client, null)
  assert.equal(storeLink('cliente', 's1'), '/cliente/tiendas#s1')
  assert.equal(storeLink(null, 's1'), '/tiendas#s1')
  const categories = landingCategories([{ id: 'a', nombre: 'Frenos' }, { id: 'b', nombre: 'Pastillas', categoria_padre_id: 'a' }, { id: 'c', nombre: 'Motor' }])
  assert.deepEqual(categories.map((item) => [item.id, item.subcategorias]), [['a', 1], ['c', 0]])
  const stores = new Map([['s1', { id: 's1', nombre: 'Uno' }]])
  const reviews = featuredReviews([
    { id: 'r1', tienda_id: 's1', comentario: 'Bien', fecha_creacion: '2026-11-01T00:00:00Z' },
    { id: 'r2', tienda_id: 's1', comentario: '  ', fecha_creacion: '2026-11-03T00:00:00Z' },
    { id: 'r3', tienda_id: 's1', comentario: 'Mejor', fecha_creacion: '2026-11-02T00:00:00Z' },
    { id: 'r4', tienda_id: 'otra', comentario: 'Fuera', fecha_creacion: '2026-11-04T00:00:00Z' },
  ], stores)
  assert.deepEqual(reviews.map((review) => review.id), ['r3', 'r1'])
})

test('store name searches treat % and _ as plain characters', async () => {
  const { escapeLike } = await import('../src/lib/search.js')
  assert.equal(escapeLike('50%_off\\'), '50\\%\\_off\\\\')
  assert.equal(escapeLike('Frenos'), 'Frenos')
  assert.equal(escapeLike(undefined), '')
})

test('glass panel helpers use real counts and Bolivian time (sesión 7)', async () => {
  const { attentionLine, greetingFor, initials, latestNotifications, notificationPath, percentOf, rollingParts, timeAgo, boliviaHour } = await import('../src/lib/panel.js')
  assert.equal(greetingFor(8), 'Buenos días')
  assert.equal(greetingFor(12), 'Buenas tardes')
  assert.equal(greetingFor(19), 'Buenas noches')
  assert.equal(boliviaHour(new Date('2026-11-10T14:00:00Z')), 10)
  assert.equal(attentionLine(0), 'Nada necesita tu atención por ahora.')
  assert.equal(attentionLine(1), '1 cosa necesita tu atención.')
  assert.equal(attentionLine('3'), '3 cosas necesitan tu atención.')
  assert.equal(percentOf(2, 0), null)
  assert.equal(percentOf(1, 3), 33)
  assert.equal(percentOf(5, 4), 100)
  assert.deepEqual(rollingParts('1.234,5').map((part) => part.digit), [1, null, 2, 3, 4, null, 5])
  assert.equal(initials('Repuestos  el Chino'), 'RE')
  assert.equal(initials('Taller'), 'TA')
  assert.equal(initials(''), '·')
  assert.equal(timeAgo('2026-11-10T11:55:00Z', Date.parse('2026-11-10T12:00:00Z')), 'hace 5 minutos')
  assert.equal(timeAgo('2026-11-09T12:00:00Z', Date.parse('2026-11-10T12:00:00Z')), 'ayer')
  assert.equal(timeAgo('no-date'), '')
  const list = [{ id: 'a', fecha_creacion: '2026-11-01' }, { id: 'b', fecha_creacion: '2026-11-03' }, { id: 'c', fecha_creacion: '2026-11-02' }]
  assert.deepEqual(latestNotifications(list, 2).map((item) => item.id), ['b', 'c'])
  assert.equal(notificationPath({ tipo: 'nueva_propuesta', solicitud_id: 's1' }, 'cliente'), '/cliente/solicitudes/s1/propuestas')
  assert.equal(notificationPath({ tipo: 'nueva_solicitud', solicitud_id: 's1' }, 'tienda'), '/tienda/solicitudes/s1')
  assert.equal(notificationPath({ tipo: 'cambio_estado_tienda' }, 'administrador'), '/admin')
})

test('panel trends compare the current period with the previous one (sesión 7, parte B)', async () => {
  const { changeLabel, groupSeries, isMissingRpc, seriesSummary, shortDay, trendFor } = await import('../src/lib/panel.js')
  const rows = [
    { serie: 'a', dia: '2026-11-04', total: 1 }, { serie: 'a', dia: '2026-11-01', total: 2 },
    { serie: 'a', dia: '2026-11-02', total: 0 }, { serie: 'a', dia: '2026-11-03', total: '3' },
  ]
  const grouped = groupSeries(rows)
  assert.deepEqual(grouped.a.map((point) => point.dia), ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'])
  const summary = seriesSummary(grouped.a, 2)
  assert.deepEqual(summary.values, [3, 1])
  assert.equal(summary.total, 4)
  assert.equal(summary.previous, 2)
  assert.equal(summary.change, 100)
  assert.equal(seriesSummary([{ dia: 'x', total: 0 }, { dia: 'y', total: 5 }], 1).change, null, 'no % when the previous period is 0')
  assert.equal(changeLabel(-8), '−8 %')
  assert.equal(changeLabel(0), 'Igual')
  assert.equal(changeLabel(null), '')
  assert.match(shortDay('2026-11-10'), /10/)
  assert.equal(trendFor(grouped, 'a', 2, ['nueva', 'nuevas']).text, '4 nuevas en 2 días')
  assert.equal(trendFor(grouped, 'b', 2, ['nueva', 'nuevas']), null)
  assert.equal(isMissingRpc({ code: 'PGRST202' }), true)
  assert.equal(isMissingRpc({ code: '42501' }), false)
})
