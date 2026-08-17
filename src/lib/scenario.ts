/**
 * Scenario engine for the Analysis page.
 *
 * Given a hypothetical spot rate, it re-evaluates every hedge: which barriers
 * are breached, how the obligation escalates, the rate the client transacts
 * at, and the AUD value of that vs the market.
 *
 * IMPORTANT — this is a transparent, first-order model built from the columns
 * in the source tool (strikes, triggers, leverage flags, obligation amounts).
 * It is meant for intuition, not settlement. Product mechanics are inferred:
 *   • Forward / FEC ....... unconditional; transacts at the protection strike.
 *   • Knock-Out ........... protection disappears if spot trades through the barrier.
 *   • Knock-In (leveraged) obligation leverages up to the max if the lower barrier breaks;
 *                            the upper barrier is an improver (a positive).
 *   • TARF ................ leveraged obligation engages below the strike.
 * Assumptions are surfaced in the UI so a user can sanity-check them.
 */

import type { Portfolio, Trade } from './types'
import { classify, classifyBarrier, isFavourable, sideOf } from './knowledge'

export type Perspective = 'sellUSD' | 'buyUSD'
export type Observation = 'expiry' | 'window' | 'duration'

export type ScenarioStatus =
  | 'committed' // forward / NDF — must transact at the rate
  | 'protected' // protection engaged as intended (spot unfavourable)
  | 'participating' // participating in a favourable move (transacts near spot)
  | 'capped' // favourable move, but obligated at the participation / enhanced cap
  | 'obligated' // knock-in hit — participation lost, obligated at protection rate (adverse)
  | 'geared' // enhanced/leveraged obligation engaged (adverse); displayed as "Leveraged"
  | 'knocked-out' // protection knocked out (adverse)
  | 'improved' // protection rate improved (positive)
  | 'inactive' // expired / no data

export interface Barrier {
  level: number
  kind: 'trigger' | 'trigger2'
  label: string
  breached: boolean
  /** signed distance spot − level. */
  distance: number
  /** |distance| / level. */
  distancePct: number
  adverse: boolean
}

export interface TradeScenario {
  trade: Trade
  status: ScenarioStatus
  statusLabel: string
  adverse: boolean
  obligationUSD: number
  effectiveRate: number | null
  barriers: Barrier[]
  hedgedAUD: number
  marketAUD: number
  /** Signed AUD benefit vs transacting at market, per the chosen perspective. */
  benefitAUD: number
  /** USD left exposed to the market (protection lost / not engaged). */
  exposedUSD: number
}

export interface PortfolioScenario {
  spot: number
  perspective: Perspective
  observation: Observation
  rows: TradeScenario[]
  totalObligationUSD: number
  totalBenefitAUD: number
  totalExposedUSD: number
  adverseCount: number
}

function statusText(s: ScenarioStatus): string {
  switch (s) {
    case 'committed': return 'Committed'
    case 'protected': return 'Protected'
    case 'participating': return 'Participating'
    case 'capped': return 'Capped at rate'
    case 'obligated': return 'Obligated at protection'
    case 'geared': return 'Leveraged up'
    case 'knocked-out': return 'Knocked out'
    case 'improved': return 'Improved'
    default: return 'Inactive'
  }
}

export function evaluateTrade(t: Trade, spot: number, perspective: Perspective): TradeScenario {
  const strike = t.protectionStrike // Protection / Enhanced Rate
  const side = sideOf(t)
  const cls = classify(t)
  const fam = t.family
  let status: ScenarioStatus = 'protected'
  let obligationUSD = t.protection
  let effectiveRate: number | null = strike
  let exposedUSD = 0
  const barriers: Barrier[] = []

  // Classify every barrier via the shared Rules-of-Barriers logic.
  for (const [level, kind] of [
    [t.trigger, 'trigger'],
    [t.trigger2, 'trigger2'],
  ] as const) {
    if (level == null) continue
    const v = classifyBarrier(t, level, spot)
    barriers.push({
      level,
      kind,
      label: v.label,
      breached: v.breached,
      distance: spot - level,
      distancePct: Math.abs(spot - level) / level,
      adverse: v.adverse,
    })
  }

  const favourable = strike != null && isFavourable(side, spot, strike)
  const badHit = barriers.some((b) => b.adverse && b.breached)
  const koConvertibleHit = barriers.some((b) => !b.adverse && b.breached && /knock-out/.test(b.label))
  const participation = t.participationStrike // Participation / cap rate
  const beyondCap = participation != null && isFavourable(side, spot, participation)

  const isForward = fam === 'Forward' || /\bfec\b|\bndf\b|synthetic|outright/.test(t.product.toLowerCase())

  if (isForward) {
    // FEC / NDF / synthetic FEC — unconditional obligation at the rate.
    status = 'committed'
    obligationUSD = t.protection
    effectiveRate = strike
  } else if (koConvertibleHit) {
    // Convertible knock-out fired → becomes a vanilla: full protection + upside.
    status = favourable ? 'participating' : 'protected'
    obligationUSD = t.protection
    effectiveRate = favourable ? spot : strike
  } else if (fam === 'Knock-Out') {
    if (badHit) {
      status = 'knocked-out'
      obligationUSD = 0
      effectiveRate = null
      exposedUSD = t.protection
    } else if (favourable) {
      // Enhanced rate holds; a favourable move obligates at the enhanced rate,
      // geared up when the structure is leveraged.
      status = t.leveraged ? 'geared' : 'capped'
      obligationUSD = t.leveraged ? t.maxObligation || t.protection * 2 : t.protection
      effectiveRate = strike
    } else {
      status = 'protected'
      obligationUSD = t.protection
      effectiveRate = strike
    }
  } else if (fam === 'TARF') {
    if (favourable) {
      status = t.leveraged ? 'geared' : 'capped'
      obligationUSD = t.leveraged ? t.maxObligation || t.protection * 2 : t.protection
    } else {
      status = 'protected'
      obligationUSD = t.protection
    }
    effectiveRate = strike
  } else if (cls === 'Participate' || fam === 'Knock-In' || fam === 'Knock-In Improver') {
    // Knock-in family: participate up to the knock-in unless a bad trigger hits.
    if (badHit) {
      status = 'obligated' // knock-in hit → participation lost, obligated at protection
      obligationUSD = t.protection
      effectiveRate = strike
    } else if (favourable) {
      status = beyondCap ? 'capped' : 'participating'
      effectiveRate = beyondCap ? participation : spot
      obligationUSD = t.protection
    } else {
      status = 'protected'
      obligationUSD = t.protection
      effectiveRate = strike
    }
  } else {
    // Protect family with participation (Collar / Participator / Vanilla).
    if (favourable) {
      status = beyondCap ? 'capped' : 'participating'
      effectiveRate = beyondCap ? participation : spot
      obligationUSD = t.protection
    } else {
      status = t.protection > 0 ? 'protected' : 'inactive'
      obligationUSD = t.protection
      effectiveRate = strike
    }
  }

  const adverse = status === 'geared' || status === 'knocked-out' || status === 'obligated'

  // AUD conversion. AUD/USD is USD-per-AUD, so AUD = USD / rate.
  const hedgedAUD = effectiveRate ? obligationUSD / effectiveRate : obligationUSD / spot
  const marketAUD = obligationUSD / spot
  let benefitAUD = 0
  if (effectiveRate) {
    benefitAUD = perspective === 'sellUSD' ? hedgedAUD - marketAUD : marketAUD - hedgedAUD
  }

  return {
    trade: t,
    status,
    statusLabel: statusText(status),
    adverse,
    obligationUSD,
    effectiveRate,
    barriers,
    hedgedAUD,
    marketAUD,
    benefitAUD,
    exposedUSD,
  }
}

export function evaluatePortfolio(
  p: Portfolio,
  spot: number,
  perspective: Perspective,
  observation: Observation,
  onlyActive = true,
): PortfolioScenario {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const trades = onlyActive ? p.trades.filter((t) => t.expiry >= now) : p.trades
  const rows = trades.map((t) => evaluateTrade(t, spot, perspective))
  return {
    spot,
    perspective,
    observation,
    rows,
    totalObligationUSD: rows.reduce((s, r) => s + r.obligationUSD, 0),
    totalBenefitAUD: rows.reduce((s, r) => s + r.benefitAUD, 0),
    totalExposedUSD: rows.reduce((s, r) => s + r.exposedUSD, 0),
    adverseCount: rows.filter((r) => r.adverse).length,
  }
}

/** Sample the portfolio outcome across a spot range for the payoff chart. */
export function payoffCurve(
  p: Portfolio,
  perspective: Perspective,
  range: { min: number; max: number; steps?: number },
): Array<{ spot: number; benefitAUD: number; obligationUSD: number; adverse: number }> {
  const steps = range.steps ?? 60
  const out: Array<{ spot: number; benefitAUD: number; obligationUSD: number; adverse: number }> = []
  for (let i = 0; i <= steps; i++) {
    const spot = range.min + ((range.max - range.min) * i) / steps
    const s = evaluatePortfolio(p, spot, perspective, 'expiry')
    out.push({
      spot: Number(spot.toFixed(4)),
      benefitAUD: Math.round(s.totalBenefitAUD),
      obligationUSD: s.totalObligationUSD,
      adverse: s.adverseCount,
    })
  }
  return out
}

/** A sensible default spot: the protection-weighted average strike of the book. */
export function impliedSpot(p: Portfolio): number {
  let num = 0
  let den = 0
  for (const t of p.trades) {
    if (t.protectionStrike && t.protection) {
      num += t.protectionStrike * t.protection
      den += t.protection
    }
  }
  return den ? Number((num / den).toFixed(4)) : 0.65
}

/** Barrier bounds across the book, to frame the spot slider. */
export function spotBounds(p: Portfolio): { min: number; max: number } {
  const levels: number[] = []
  for (const t of p.trades) {
    if (t.protectionStrike) levels.push(t.protectionStrike)
    if (t.trigger) levels.push(t.trigger)
    if (t.trigger2) levels.push(t.trigger2)
  }
  if (!levels.length) return { min: 0.55, max: 0.8 }
  const lo = Math.min(...levels)
  const hi = Math.max(...levels)
  const pad = Math.max((hi - lo) * 0.35, 0.03)
  return { min: Number((lo - pad).toFixed(2)), max: Number((hi + pad).toFixed(2)) }
}
