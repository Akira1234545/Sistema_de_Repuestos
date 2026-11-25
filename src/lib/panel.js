// Helpers for the «glass» panel homes (sesión 7). Pure functions so node --test can cover them.
import { ADMIN_ROLES } from './roles.js'

const TIME_ZONE = 'America/La_Paz'

export function prefersReducedMotion() {
	return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

export function boliviaHour(date = new Date()) {
	return Number(new Intl.DateTimeFormat('es-BO', { hour: 'numeric', hourCycle: 'h23', timeZone: TIME_ZONE }).format(date))
}

export function greetingFor(hour) {
	return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
}

// «martes, 10 de noviembre»
export function todayLabel(date = new Date()) {
	return new Intl.DateTimeFormat('es-BO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIME_ZONE }).format(date)
}

// Line under the greeting. `count` is always a real number from the panel's own data.
export function attentionLine(count) {
	const total = Number(count) || 0
	if (total <= 0) return 'Nada necesita tu atención por ahora.'
	return `${total} ${total === 1 ? 'cosa necesita' : 'cosas necesitan'} tu atención.`
}

// Whole percentage for the progress ring, or null when there is nothing to measure yet.
export function percentOf(value, total) {
	const part = Number(value) || 0
	const whole = Number(total) || 0
	if (whole <= 0) return null
	return Math.min(100, Math.max(0, Math.round((part / whole) * 100)))
}

// Characters of a formatted number, marking which ones roll (digits) and which stay put (separators).
export function rollingParts(text) {
	return Array.from(String(text)).map((char) => (/\d/u.test(char) ? { char, digit: Number(char) } : { char, digit: null }))
}

export function formatCount(value, decimals = 0) {
	return Number(value || 0).toLocaleString('es-BO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function initials(name) {
	const words = String(name || '').trim().split(/\s+/u).filter(Boolean)
	if (!words.length) return '·'
	return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toLocaleUpperCase('es')
}

const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

// «hace 5 minutos», «ayer», «hace 3 días»…
export function timeAgo(value, now = Date.now()) {
	const time = new Date(value).getTime()
	if (!Number.isFinite(time)) return ''
	const seconds = Math.round((time - now) / 1000)
	const steps = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']]
	let amount = seconds
	for (const [size, unit] of steps) {
		if (Math.abs(amount) < size) return relative.format(Math.round(amount), unit)
		amount /= size
	}
	return ''
}

// Where a notification leads, per role (also used by the bell).
export function notificationPath(notification, role) {
	if (notification.tipo === 'cambio_estado_tienda') return role === 'tienda' ? '/tienda' : ADMIN_ROLES.includes(role) ? '/admin' : ''
	if (!notification.solicitud_id) return ''
	if (role === 'tienda') return `/tienda/solicitudes/${notification.solicitud_id}`
	if (role === 'cliente' && ['nueva_propuesta', 'propuesta_seleccionada', 'cambio_estado_propuesta'].includes(notification.tipo)) {
		return `/cliente/solicitudes/${notification.solicitud_id}/propuestas`
	}
	if (role === 'cliente') return '/cliente/solicitudes'
	return ''
}

// Latest notifications first, regardless of read state (the bell lists unread first).
export function latestNotifications(list, limit = 4) {
	return [...(list || [])]
		.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
		.slice(0, limit)
}

// ---------- Series (parte B: RPC dashboard_series) ----------

// Rows { serie, dia, total } → { serie: [{ dia, total }] } sorted by day.
export function groupSeries(rows) {
	const out = {}
	for (const row of rows || []) (out[row.serie] ||= []).push({ dia: String(row.dia).slice(0, 10), total: Number(row.total) || 0 })
	for (const list of Object.values(out)) list.sort((a, b) => a.dia.localeCompare(b.dia))
	return out
}

// The RPC returns 2 × days points: the previous period, then the current one.
// change is null when the previous period had nothing (a % of 0 means nothing).
export function seriesSummary(points, days) {
	const list = (points || []).slice(-2 * days)
	const current = list.slice(-days)
	const previous = list.slice(0, Math.max(0, list.length - days))
	const total = current.reduce((sum, point) => sum + point.total, 0)
	const before = previous.reduce((sum, point) => sum + point.total, 0)
	return {
		points: current,
		values: current.map((point) => point.total),
		total,
		previous: before,
		change: previous.length === days && before > 0 ? Math.round(((total - before) / before) * 100) : null,
	}
}

export function changeLabel(change) {
	if (change == null) return ''
	if (change === 0) return 'Igual'
	return `${change > 0 ? '+' : '−'}${Math.abs(change)} %`
}

// «lun 3 nov»
export function shortDay(isoDay) {
	const [year, month, day] = String(isoDay).split('-').map(Number)
	if (!year) return ''
	return new Intl.DateTimeFormat('es-BO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
}

// The RPC is new (migración 20261117): until it is applied the panel simply hides the trends.
export function isMissingRpc(error) {
	return ['PGRST202', '42883'].includes(error?.code)
}

// KPI trend from a series: sparkline values, % change and «N nuevas en 7 días».
export function trendFor(series, key, days, [one, many]) {
	if (!series?.[key]) return null
	const summary = seriesSummary(series[key], days)
	return { values: summary.values, change: summary.change, text: `${formatCount(summary.total)} ${summary.total === 1 ? one : many} en ${days} días` }
}
