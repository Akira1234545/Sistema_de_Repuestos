// Mirrors the Supabase Auth policy for this project (Authentication → Email): at least
// 12 characters here (Supabase asks for 8) with lowercase, uppercase, digits and symbols.
export const PASSWORD_HINT = 'Mínimo 12 caracteres con mayúsculas, minúsculas, números y símbolos.'

export function passwordIssue(password) {
  const value = String(password || '')
  if (value.length < 12) return 'Usa al menos 12 caracteres.'
  const missing = [
    [/[a-z]/, 'una minúscula'],
    [/[A-Z]/, 'una mayúscula'],
    [/\d/, 'un número'],
    [/[^A-Za-z0-9\s]/, 'un símbolo'],
  ].filter(([pattern]) => !pattern.test(value)).map(([, label]) => label)
  if (!missing.length) return ''
  const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} y ${missing.at(-1)}`
  return `Añade al menos ${list}.`
}
