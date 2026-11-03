export function whatsappPhone(phone) {
  const value = String(phone || '').trim()
  let digits = value.replace(/\D/g, '')
  if (value.startsWith('00')) digits = digits.slice(2)
  else if (!value.startsWith('+') && digits.length === 8) digits = `591${digits}`
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : ''
}

export function boliviaDay(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const data = Object.fromEntries(parts.map(p => [p.type, p.value]))
  return `${data.year}-${data.month}-${data.day}`
}

export function boliviaDateTimeInput(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const data = Object.fromEntries(parts.map(p => [p.type, p.value]))
  return `${data.year}-${data.month}-${data.day}T${data.hour}:${data.minute}`
}

const currency = new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' })
export function money(value) {
  return currency.format(Number(value))
}

export function vehicleYearLimit(now = new Date()) {
  return Number(boliviaDay(now).slice(0, 4)) + 1
}

// Human labels for the status values stored in the database; unknown values fall back to sentence case.
const statusLabels = {
  publicada: 'Publicada',
  recibiendo_propuestas: 'Recibiendo propuestas',
  propuesta_seleccionada: 'Propuesta seleccionada',
  atendida: 'Atendida',
  cerrada: 'Cerrada',
  enviada: 'Enviada',
  aceptada: 'Seleccionada',
  rechazada: 'No seleccionada',
  retirada: 'Retirada',
}
export function statusLabel(value) {
  if (!value) return ''
  if (statusLabels[value]) return statusLabels[value]
  const text = String(value).replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
