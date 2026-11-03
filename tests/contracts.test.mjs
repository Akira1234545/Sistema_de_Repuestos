import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { publicError } from '../src/lib/errors.js'

function parseArguments(signature) {
  const segments = []
  let depth = 0
  let start = 0
  for (let index = 0; index < signature.length; index += 1) {
    if (signature[index] === '(') depth += 1
    if (signature[index] === ')') depth -= 1
    if (signature[index] === ',' && depth === 0) {
      segments.push(signature.slice(start, index))
      start = index + 1
    }
  }
  if (signature.slice(start).trim()) segments.push(signature.slice(start))
  return segments.map(segment => ({
    name: segment.match(/\b(p_\w+)\s+/)?.[1],
    optional: /\bDEFAULT\b|=/.test(segment),
  })).filter(argument => argument.name)
}

test('every frontend RPC has a versioned SQL definition', async () => {
  const migrations = await readdir('database/migrations')
  const sql = (await Promise.all(migrations.map(file => readFile(`database/migrations/${file}`, 'utf8')))).join('\n')
  const definitions = new Map()
  for (const match of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.(\w+)\s*\(([\s\S]*?)\)\s*(?=RETURNS|LANGUAGE)/gi)) {
    definitions.set(match[1], parseArguments(match[2]))
  }
  const files = (await readdir('src', { recursive: true })).filter(file => /\.(jsx?|mjs)$/.test(file))
  const frontendRpcs = new Set()
  for (const file of files) {
    const text = await readFile(`src/${file}`, 'utf8')
    for (const match of text.matchAll(/\.rpc\('([^']+)'(?:\s*,\s*\{([^}]*)\})?/gs)) {
      const [, name, body = ''] = match
      frontendRpcs.add(name)
      assert.ok(definitions.has(name), `${file}: missing SQL RPC ${name}`)
      const sent = [...body.matchAll(/\b(p_\w+)\s*:/g)].map(argument => argument[1]).sort()
      const declared = definitions.get(name)
      const declaredNames = declared.map(argument => argument.name).sort()
      assert.ok(sent.every(argument => declaredNames.includes(argument)), `${file}: RPC ${name} sends an unknown SQL argument`)
      const required = declared.filter(argument => !argument.optional).map(argument => argument.name).sort()
      assert.deepEqual(sent.filter(argument => required.includes(argument)), required, `${file}: RPC ${name} omits a required SQL argument`)
    }
  }
  const preflight = await readFile('database/preflight_rpc.sql', 'utf8')
  const preflightRpcs = new Set([...preflight.matchAll(/\('([a-z0-9_]+)'\)/g)].map(match => match[1]))
  assert.deepEqual([...preflightRpcs].sort(), [...frontendRpcs].sort(), 'remote RPC preflight must cover every frontend RPC exactly')
})
test('public errors keep business instructions and hide internal SQL details', () => {
  assert.match(publicError({ message: 'Las fotos cambiaron en otra sesión.' }), /Las fotos/)
  assert.doesNotMatch(publicError({ message: 'relation public.usuarios does not exist' }), /usuarios|relation|SQL/)
  assert.match(publicError({ code: 'invalid_credentials' }), /incorrectos/)
})
