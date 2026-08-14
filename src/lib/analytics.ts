/**
 * Derived analytics for the Overview page.
 * Everything here is a pure function of a Portfolio, so it recomputes cleanly
 * whenever a new paste is imported.
 */

import { fmtDay, startOfDay } from './format'
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

/** When a trigger is observable. */
export type TriggerObservation = 'window' | 'expiry' | 'lifetime'

export interface TriggerEvent {
  trade: Trade
  /** The barrier level in focus. */
  level: number
  /** Which leg of the trade this barrier belongs to. */
  kind: 'trigger' | 'trigger2'
  /** When the barrier window opens (falls back to expiry). */
  date: Date
  windowEnd: Date | null
  /** When this trigger is live. */
  observation: TriggerObservation
  /** Plain-language description of when it is live and what breaching it means. */
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

/** A currency pair's protection-weighted average rate. */
export interface PairRate {
  pair: string
  weightedRate: number | null
  protection: number
}

/** The set of currency pairs in the book, ordered by protection (largest first). */
export function pairsByProtection(p: Portfolio): string[] {
  const totals = new Map<string, number>()
  for (const t of p.trades) {
    const pair = t.ccy || p.pair
    totals.set(pair, (totals.get(pair) ?? 0) + t.protection)
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([pair]) => pair)
}

/**
 * Protection-weighted average protection rate for each currency pair. Rates
 * across different pairs (e.g. 0.65 AUD/USD vs 1.08 EUR/USD) must never be
 * blended, so they are always reported per pair.
 */
export function ratesByPair(p: Portfolio): PairRate[] {
  const m = new Map<string, { num: number; den: number; protection: number }>()
  for (const t of p.trades) {
    const pair = t.ccy || p.pair
    let a = m.get(pair)
    if (!a) {
      a = { num: 0, den: 0, protection: 0 }
      m.set(pair, a)
    }
    a.protection += t.protection
    if (t.protectionStrike && t.protection) {
      a.num += t.protectionStrike * t.protection
      a.den += t.protection
    }
  }
  return [...m.entries()]
    .map(([pair, a]) => ({ pair, weightedRate: a.den ? a.num / a.den : null, protection: a.protection }))
    .sort((x, y) => y.protection - x.protection)
}

/** Product make-up for a single currency pair. */
export interface PairMakeup {
  pair: string
  slices: ProductSlice[]
  protection: number
}

/**
 * Product make-up split per currency pair, so a pair's category mix is never
 * conflated with another's. Returns one entry per pair, largest book first.
 */
export function makeupByPair(p: Portfolio): PairMakeup[] {
  return pairsByProtection(p).map((pair) => {
    const slices = productMakeup({ ...p, trades: p.trades.filter((t) => (t.ccy || p.pair) === pair) })
    return { pair, slices, protection: slices.reduce((s, d) => s + d.protection, 0) }
  })
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
 * Upcoming barrier / trigger events, soonest first. Each carries when it is
 * observable and a plain-language note of what breaching it would mean.
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
      const observation = observationOf(t, leg.start, leg.end)
      events.push({
        trade: t,
        level: leg.level,
        kind: leg.kind,
        date,
        windowEnd: leg.end,
        observation,
        note: triggerNote(t, leg.level, observation, leg.start, leg.end),
      })
    }
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, limit)
}

/** How a trigger is observed: within a window, only at expiry, or continuously. */
function observationOf(t: Trade, legStart: Date | null, legEnd: Date | null): TriggerObservation {
  const n = t.product.toLowerCase()
  if (/window/.test(n) || (legStart && legEnd)) return 'window'
  if (/expiry/.test(n)) return 'expiry'
  return 'lifetime'
}

/** LHS obligates above the trigger; RHS obligates below it. */
function sideOf(t: Trade): 'LHS' | 'RHS' | null {
  if (/\brhs\b/i.test(t.product)) return 'RHS'
  if (/\blhs\b/i.test(t.product)) return 'LHS'
  return null
}

/** "Live during the window (…). If AUD/USD is above 0.6930 then, you're obligated…" */
function triggerNote(
  t: Trade,
  level: number,
  obs: TriggerObservation,
  start: Date | null,
  end: Date | null,
): string {
  const when =
    obs === 'window'
      ? start && end
        ? `Live only during the window (${fmtDay(start)} – ${fmtDay(end)})`
        : 'Live only during the observation window'
      : obs === 'expiry'
        ? 'Live only at 3pm Tokyo on the expiry date'
        : 'Live throughout the life of the trade'

  const pair = t.ccy || 'the spot rate'
  const side = sideOf(t)
  const cond =
    side === 'RHS'
      ? `if ${pair} is below ${level.toFixed(4)}`
      : side === 'LHS'
        ? `if ${pair} is above ${level.toFixed(4)}`
        : `if ${pair} trades through ${level.toFixed(4)}`
  return `${when} — ${cond} in that period, you're obligated at your protection (or enhanced) rate.`
}

/**
 * Protection & obligation timeline for the overview area chart.
 *
 * The chart looks forward from the first live expiry: leading months with no
 * cover — and any month in the past — are dropped, and trailing all-zero
 * months are trimmed (keeping one month of padding). Hedges cannot sit in the
 * past, so a spuriously-dated early row never drags the axis backwards.
 */
export function timeline(p: Portfolio): MonthlyPoint[] {
  const rows = p.monthly
  if (!rows.length) return []
  let firstActive = -1
  let lastActive = -1
  rows.forEach((m, i) => {
    if (m.protection > 0 || m.maxObligation > 0) {
      if (firstActive < 0) firstActive = i
      lastActive = i
    }
  })
  if (firstActive < 0) return []

  const monthStart = today()
  monthStart.setDate(1)
  let start = firstActive
  while (start < lastActive && rows[start].month < monthStart) start++

  const end = Math.min(rows.length, lastActive + 2)
  return rows.slice(start, end)
}

/**
 * Strip key for a trade — the identifier a set of related expiries share.
 * A strip is one structure booked across several expiries under one ticket;
 * FEC strips share a ticket base with a differing "_00N" suffix, so that
 * suffix is stripped. Trades with no ticket stand alone under their own id.
 */
export function stripKeyOf(t: Trade): string {
  if (t.ticket) return t.ticket.replace(/_0*\d+$/, '')
  return t.id
}

/** All trades belonging to a strip, earliest expiry first. */
export function tradesInStrip(p: Portfolio, key: string): Trade[] {
  return p.trades.filter((t) => stripKeyOf(t) === key).sort((a, b) => a.expiry.getTime() - b.expiry.getTime())
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
