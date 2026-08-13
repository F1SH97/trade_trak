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
 *   • Knock-In (geared) ... obligation gears up to the max if the lower barrier breaks;
 *                            the upper barrier is an improver (a positive).
 *   • TARF ................ geared obligation engages below the strike.
 * Assumptions are surfaced in the UI so a user can sanity-check them.
 */

import type { Portfolio, Trade } from './types'

export type Perspective = 'sellUSD' | 'buyUSD'
export type Observation = 'expiry' | 'window' | 'duration'

export type ScenarioStatus =
  | 'committed' // forward — must transact at strike
  | 'protected' // protection engaged as intended
  | 'geared' // leverage triggered — obligation increased (adverse)
  | 'knocked-out' // protection lost (adverse)
  | 'improved' // upside condition met (positive)
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

const EPS = 1e-6

function statusText(s: ScenarioStatus): string {
  switch (s) {
    case 'committed': return 'Committed'
    case 'protected': return 'Protected'
    case 'geared': return 'Geared up'
    case 'knocked-out': return 'Knocked out'
    case 'improved': return 'Improved'
    default: return 'Inactive'
  }
}

export function evaluateTrade(t: Trade, spot: number, perspective: Perspective): TradeScenario {
  const strike = t.protectionStrike
  let status: ScenarioStatus = 'protected'
  let obligationUSD = t.protection
  let effectiveRate: number | null = strike
  let exposedUSD = 0
  const barriers: Barrier[] = []

  const addBarrier = (level: number | null, kind: 'trigger' | 'trigger2', label: string, adverse: boolean, breached: boolean) => {
    if (level == null) return
    barriers.push({
      level,
      kind,
      label,
      breached,
      distance: spot - level,
      distancePct: Math.abs(spot - level) / level,
      adverse,
    })
  }

  switch (t.family) {
    case 'Forward':
      status = 'committed'
      obligationUSD = t.protection
      effectiveRate = strike
      break

    case 'Knock-Out': {
      const barrier = t.trigger ?? null
      const knockedOut = barrier != null && spot <= barrier + EPS
      addBarrier(barrier, 'trigger', 'Knock-out barrier', true, knockedOut)
      if (knockedOut) {
        status = 'knocked-out'
        obligationUSD = 0
        effectiveRate = null
        exposedUSD = t.protection
      } else {
        status = 'protected'
        obligationUSD = t.protection
        effectiveRate = strike
      }
      break
    }

    case 'Knock-In': {
      const lower = t.trigger ?? strike ?? null // gearing knock-in
      const upper = t.trigger2 ?? null // improver
      const geared = lower != null && spot <= lower + EPS
      const improved = upper != null && spot >= upper - EPS
      addBarrier(lower, 'trigger', 'Gearing knock-in', true, geared)
      addBarrier(upper, 'trigger2', 'Improver barrier', false, improved)
      if (geared) {
        status = 'geared'
        obligationUSD = t.maxObligation || t.protection * 2
        effectiveRate = strike
      } else if (improved) {
        status = 'improved'
        obligationUSD = t.protection
        effectiveRate = strike
      } else {
        status = 'protected'
        obligationUSD = t.protection
        effectiveRate = strike
      }
      break
    }

    case 'TARF': {
      const geared = strike != null && spot <= strike + EPS && t.leveraged
      addBarrier(t.trigger ?? null, 'trigger', 'Target / barrier', false, t.trigger != null && spot <= t.trigger + EPS)
      if (geared) {
        status = 'geared'
        obligationUSD = t.maxObligation || t.protection * 2
      } else {
        status = 'protected'
        obligationUSD = t.protection
      }
      effectiveRate = strike
      break
    }

    default:
      status = t.protection > 0 ? 'protected' : 'inactive'
      obligationUSD = t.protection
      effectiveRate = strike
      if (t.trigger != null) addBarrier(t.trigger, 'trigger', 'Barrier', t.leveraged, spot <= t.trigger + EPS)
  }

  const adverse = status === 'geared' || status === 'knocked-out'

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
