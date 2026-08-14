/**
 * Derived analytics for the Overview page.
 * Everything here is a pure function of a Portfolio, so it recomputes cleanly
 * whenever a new paste is imported.
 */

import { startOfDay } from './format'
import type { MonthlyPoint, Portfolio, Trade } from './types'

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
  family: string
  protection: number
  maxObligation: number
  count: number
  credit: number
}

/**
 * How breaching a barrier lands for the client:
 *   • adverse — re-strikes / gears to a worse outcome;
 *   • upside  — an improver / positive condition;
 *   • mixed   — can cut either way (knock-outs, target redemptions).
 */
export type BarrierSentiment = 'adverse' | 'upside' | 'mixed'

export interface TriggerEvent {
  trade: Trade
  /** The barrier level in focus. */
  level: number
  /** Which leg of the trade this barrier belongs to. */
  kind: 'trigger' | 'trigger2'
  /** When the barrier window opens (falls back to expiry). */
  date: Date
  windowEnd: Date | null
  /** Client-side impact of breaching this barrier. */
  sentiment: BarrierSentiment
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

/** Group protection / obligation / credit by product family. */
export function productMakeup(p: Portfolio): ProductSlice[] {
  const map = new Map<string, ProductSlice>()
  for (const t of p.trades) {
    let s = map.get(t.family)
    if (!s) {
      s = { family: t.family, protection: 0, maxObligation: 0, count: 0, credit: 0 }
      map.set(t.family, s)
    }
    s.protection += t.protection
    s.maxObligation += t.maxObligation
    s.credit += t.credit ?? 0
    s.count += 1
  }
  return [...map.values()].sort((a, b) => b.protection - a.protection)
}

/** Next expiry on or after today. */
export function nextExpiry(p: Portfolio): Trade | null {
  const now = today()
  const upcoming = p.trades.filter((t) => t.expiry >= now).sort((a, b) => a.expiry.getTime() - b.expiry.getTime())
  return upcoming[0] ?? null
}

/**
 * Upcoming barrier / trigger events, soonest first.
 *
 * Sentiment rules of thumb:
 *   • Knock-IN above the protection rate → adverse (re-strikes you to a worse
 *     rate); at or below the protection rate it reads as an improver / upside.
 *   • Knock-OUT → mixed: typically knocks out either the whole structure or
 *     just the obligation leg, so it can help or hurt.
 *   • TARF target barrier → mixed (redeems as the target accrues).
 */
export function upcomingTriggers(p: Portfolio, limit = 8): TriggerEvent[] {
  const now = today()
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
      const { sentiment, note } = classifyBarrier(t, leg.level, leg.kind)
      events.push({ trade: t, level: leg.level, kind: leg.kind, date, windowEnd: leg.end, sentiment, note })
    }
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, limit)
}

function classifyBarrier(
  t: Trade,
  level: number,
  kind: 'trigger' | 'trigger2',
): { sentiment: BarrierSentiment; note: string } {
  const fam = t.family
  const ps = t.protectionStrike
  if (fam === 'Knock-Out') {
    return {
      sentiment: 'mixed',
      note: `Knock-out at ${level.toFixed(4)} — typically removes the whole structure or just the obligation leg, so it can help or hurt.`,
    }
  }
  if (fam === 'Knock-In' || fam === 'Knock-In Improver') {
    // A knock-in above the protection rate re-strikes the client to a worse rate.
    if (ps != null && level > ps + 1e-6) {
      return {
        sentiment: 'adverse',
        note: `Knocks in at ${level.toFixed(4)}, above the ${ps.toFixed(4)} protection rate — re-strikes you to a worse rate.`,
      }
    }
    return {
      sentiment: 'upside',
      note: `Knock-in at ${level.toFixed(4)}, at or below the protection rate — an improver / upside condition.`,
    }
  }
  if (fam === 'TARF') {
    return { sentiment: 'mixed', note: `Target barrier at ${level.toFixed(4)}; trade redeems as the target accrues.` }
  }
  // default: a lower barrier on a leveraged trade tends to add obligation
  const adverse = t.leveraged && kind === 'trigger'
  return {
    sentiment: adverse ? 'adverse' : 'upside',
    note: adverse
      ? `Barrier at ${level.toFixed(4)} increases obligation if breached.`
      : `Conditional barrier at ${level.toFixed(4)}.`,
  }
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
