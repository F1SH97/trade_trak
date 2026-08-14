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

/**
 * An aesthetically pleasing linear axis for a value range: a rounded
 * [lo, hi] domain plus evenly-spaced "nice" tick values (1 / 2 / 5 × 10ⁿ).
 * The domain lifts off zero when the data does, so variance stays visible,
 * but the lower bound never sits above the data (nothing gets clipped).
 */
export function niceAxis(dataMin: number, dataMax: number, targetTicks = 5): { domain: [number, number]; ticks: number[] } {
  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax) || dataMax <= 0) return { domain: [0, 1], ticks: [0, 1] }
  const lo0 = Math.max(0, Math.min(dataMin, dataMax))
  const hi0 = Math.max(dataMin, dataMax)
  const niceNum = (x: number, round: boolean) => {
    if (x <= 0) return 1
    const exp = Math.floor(Math.log10(x))
    const f = x / 10 ** exp
    const nf = round ? (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) : f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
    return nf * 10 ** exp
  }
  const step = niceNum((hi0 - lo0 || hi0) / Math.max(1, targetTicks - 1), true)
  let lo = Math.floor(lo0 / step) * step
  // leave a little breathing room below the data unless it reaches zero
  if (lo > 0 && lo0 - lo < step * 0.5) lo = Math.max(0, lo - step)
  const hi = Math.max(lo + step, Math.ceil(hi0 / step) * step)
  const ticks: number[] = []
  for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(Math.round(v))
  return { domain: [lo, hi], ticks }
}
