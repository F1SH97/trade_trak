/** Number / date / rate formatting helpers, kept locale-stable. */

const USD0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const NUM0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function usd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return USD0.format(n)
}

/** Compact currency for tight tiles: $1.2M, $640k. */
export function usdCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 0)}k`
  return `${sign}$${NUM0.format(abs)}`
}

export function num(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return NUM0.format(n)
}

/** FX rate, 4 dp — the convention in the source tool. */
export function rate(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toFixed(4)
}

export function pct(fraction: number | null | undefined, dp = 1): string {
  if (fraction == null || Number.isNaN(fraction)) return '—'
  return `${(fraction * 100).toFixed(dp)}%`
}

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' })
const DAY = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
const DAY_LONG = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

export function fmtMonth(d: Date | null | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return '—'
  return MONTH.format(d)
}

export function fmtDay(d: Date | null | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return '—'
  return DAY.format(d)
}

export function fmtDayLong(d: Date | null | undefined): string {
  if (!d || Number.isNaN(d.getTime())) return '—'
  return DAY_LONG.format(d)
}

/** Whole-day difference from `from` to `to` (to − from). */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.round(ms / 86_400_000)
}

/** "in 12 days", "in 3 months", "today", "5 days ago". */
export function relativeDays(target: Date, from = new Date()): string {
  const d = daysBetween(startOfDay(from), startOfDay(target))
  if (d === 0) return 'today'
  const ahead = d > 0
  const n = Math.abs(d)
  let label: string
  if (n < 21) label = `${n} day${n === 1 ? '' : 's'}`
  else if (n < 60) label = `${Math.round(n / 7)} weeks`
  else label = `${Math.round(n / 30)} months`
  return ahead ? `in ${label}` : `${label} ago`
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
