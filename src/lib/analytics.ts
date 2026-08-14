/**
 * Derived analytics for the Overview page.
 * Everything here is a pure function of a Portfolio, so it recomputes cleanly
 * whenever a new paste is imported.
 */

import { startOfDay } from './format'
import type { MonthlyPoint, Portfolio, ProductCategory, Trade } from './types'

export interface Kpis {
  totalProtection: number
  currentObligation: number
  potentialObligation: number
  maxObligation: number
  totalCredit: number
  weightedRate: number | null
  tradeCount: number
  activeTrades: number
  coverageMonths: number
  /** Currency pair label. */
  pair: string
}

export interface ProductSlice {
  category: ProductCategory
  protection: number
  maxObligation: number
  count: number
  credit: number
  /** Protection-weighted average protection strike for the category. */
  weightedRate: number | null
}

/** Rough chance the barrier is reached before it lapses. */
export type Likelihood = 'Low' | 'Medium' | 'High'

export interface TriggerEvent {
  trade: Trade
  /** The barrier level in focus. */
  level: number
  /** Which leg of the trade this barrier belongs to. */
  kind: 'trigger' | 'trigger2'
  /** When the barrier window opens (falls back to expiry). */
  date: Date
  windowEnd: Date | null
  /** Rough chance of being reached, from distance and time to the barrier. */
  likelihood: Likelihood
  note: string
}

const today = () => startOfDay(new Date())

export function computeKpis(p: Portfolio): Kpis {
  const now = today()
  let weightedNum = 0
  let weightedDen = 0
  let credit = 0
  let active = 0
  let protection = 0
  let current = 0
  let potential = 0
  let max = 0

  for (const t of p.trades) {
    protection += t.protection
    current += t.currentObligation
    potential += t.potentialObligation
    max += t.maxObligation
    credit += t.credit ?? 0
    if (t.expiry >= now) active++
    if (t.protectionStrike && t.protection) {
      weightedNum += t.protectionStrike * t.protection
      weightedDen += t.protection
    }
  }

  const months = p.monthly.filter((m) => m.protection > 0 || m.maxObligation > 0)
  return {
    totalProtection: protection,
    currentObligation: current,
    potentialObligation: potential,
    maxObligation: max,
    totalCredit: credit,
    weightedRate: weightedDen ? weightedNum / weightedDen : null,
    tradeCount: p.trades.length,
    activeTrades: active,
    coverageMonths: months.length,
    pair: p.pair,
  }
}

/** Group protection / obligation / credit by top-level product category. */
export function productMakeup(p: Portfolio): ProductSlice[] {
  type Acc = ProductSlice & { _num: number; _den: number }
  const map = new Map<ProductCategory, Acc>()
  for (const t of p.trades) {
    let s = map.get(t.category)
    if (!s) {
      s = { category: t.category, protection: 0, maxObligation: 0, count: 0, credit: 0, weightedRate: null, _num: 0, _den: 0 }
      map.set(t.category, s)
    }
    s.protection += t.protection
    s.maxObligation += t.maxObligation
    s.credit += t.credit ?? 0
    s.count += 1
    if (t.protectionStrike && t.protection) {
      s._num += t.protectionStrike * t.protection
      s._den += t.protection
    }
  }
  return [...map.values()]
    .map(({ _num, _den, ...s }) => ({ ...s, weightedRate: _den ? _num / _den : null }))
    .sort((a, b) => b.protection - a.protection)
}

/** Next expiry on or after today. */
export function nextExpiry(p: Portfolio): Trade | null {
  const now = today()
  const upcoming = p.trades.filter((t) => t.expiry >= now).sort((a, b) => a.expiry.getTime() - b.expiry.getTime())
  return upcoming[0] ?? null
}

/**
 * Upcoming barrier / trigger events, soonest first, each tagged with a rough
 * Low / Medium / High likelihood of being reached.
 */
export function upcomingTriggers(p: Portfolio, limit = 8): TriggerEvent[] {
  const now = today()
  const ref = referenceRate(p)
  const events: TriggerEvent[] = []

  for (const t of p.trades) {
    if (t.expiry < now) continue
    const legs: Array<{ level: number | null; start: Date | null; end: Date | null; kind: 'trigger' | 'trigger2' }> = [
      { level: t.trigger, start: t.windowStart, end: t.windowEnd, kind: 'trigger' },
      { level: t.trigger2, start: t.window2Start, end: t.window2End, kind: 'trigger2' },
    ]
    for (const leg of legs) {
      if (leg.level == null) continue
      const date = leg.start ?? t.expiry
      events.push({
        trade: t,
        level: leg.level,
        kind: leg.kind,
        date,
        windowEnd: leg.end,
        likelihood: likelihoodFor(leg.level, ref, date, now),
        note: barrierNote(t, leg.level),
      })
    }
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, limit)
}

/** Protection-weighted average strike — the book's centre of gravity. */
function referenceRate(p: Portfolio): number {
  let num = 0
  let den = 0
  for (const t of p.trades) {
    if (t.protectionStrike && t.protection) {
      num += t.protectionStrike * t.protection
      den += t.protection
    }
  }
  return den ? num / den : 0
}

// Rough AUD/USD annualised vol used to scale an expected move. This is an
// intuition heuristic, not a priced probability.
const ANNUAL_VOL = 0.1

/**
 * Likelihood a barrier is reached, as a z-score of its distance from the
 * reference rate in expected-move units (distance ÷ σ√t). Nearer barriers and
 * longer horizons score higher.
 */
function likelihoodFor(level: number, ref: number, date: Date, now: Date): Likelihood {
  if (!ref) return 'Medium'
  const years = Math.max((date.getTime() - now.getTime()) / (365 * 864e5), 1 / 365)
  const sigma = ref * ANNUAL_VOL * Math.sqrt(years)
  const z = Math.abs(level - ref) / (sigma || 1e-9)
  if (z < 0.75) return 'High'
  if (z < 1.75) return 'Medium'
  return 'Low'
}

/** A short, neutral description of what the barrier does. */
function barrierNote(t: Trade, level: number): string {
  const fam = t.family
  const ps = t.protectionStrike
  if (fam === 'Knock-Out') {
    return `Knock-out at ${level.toFixed(4)} — removes the structure or the obligation leg.`
  }
  if (fam === 'Knock-In' || fam === 'Knock-In Improver') {
    if (ps != null && level > ps + 1e-6) {
      return `Knocks in at ${level.toFixed(4)}, above the ${ps.toFixed(4)} protection rate — re-strikes to a worse rate.`
    }
    return `Improver at ${level.toFixed(4)} — knocks in at or below the protection rate.`
  }
  if (fam === 'TARF') {
    return `Target barrier at ${level.toFixed(4)}; trade redeems as the target accrues.`
  }
  return `Barrier at ${level.toFixed(4)}.`
}

/** Cumulative protection & obligation timeline for the overview area chart. */
export function timeline(p: Portfolio): MonthlyPoint[] {
  // Trim trailing all-zero months so the chart focuses on the active horizon
  // (keep one zero month of padding after the last active month).
  const rows = p.monthly
  let lastActive = -1
  rows.forEach((m, i) => {
    if (m.protection > 0 || m.maxObligation > 0) lastActive = i
  })
  const end = Math.min(rows.length, lastActive + 2)
  return rows.slice(0, end)
}

/** Total credit split into "in use" vs headroom, if a limit is supplied. */
export function creditUsage(p: Portfolio, limit?: number) {
  const used = p.trades.reduce((s, t) => s + (t.credit ?? 0), 0)
  return {
    used,
    limit: limit ?? null,
    headroom: limit != null ? Math.max(0, limit - used) : null,
    utilisation: limit != null && limit > 0 ? used / limit : null,
  }
}
