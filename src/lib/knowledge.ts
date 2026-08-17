/**
 * Product knowledge foundation.
 *
 * Encodes the classification and barrier mechanics from Convera's product
 * bible + product list so the Analysis scenario engine reflects real outcomes.
 * The load-bearing rules (bible "Appendix – Barriers → Rules of Barriers"):
 *
 *  Sides. Product names carry (LHS) or (RHS). For an LHS trade a HIGHER spot
 *  is favourable to the client; for RHS a LOWER spot is favourable. Rates and
 *  barriers are described relative to the Protection Rate (P).
 *
 *  Knock-IN (participation barriers). Standard KI sits on the favourable side
 *  of P (LHS: above P, RHS: below P). If spot reaches it during the
 *  observation period, participation is lost and the client is obligated at P
 *  — a BAD trigger. Inverted-KI variants sit on the far side and, if hit,
 *  obligate at the Enhanced Rate (better than P) — not adverse.
 *
 *  Knock-OUT. Standard KO sits on the unfavourable side of P (LHS: below P,
 *  RHS: above P). If hit, the remaining cover is knocked out and the client is
 *  left unhedged — a BAD trigger. Convertible variants turn the structure into
 *  a vanilla option when the KO triggers (100% protection + full flexibility)
 *  — a GOOD trigger.
 *
 *  Participation rate (observed at expiry). LHS: above P; RHS: below P. If spot
 *  is beyond it at expiry the client transacts at the Participation Rate
 *  (favourable vs P, but capped short of spot).
 *
 *  Variation rate (observed at expiry). LHS: below P; RHS: above P. If spot is
 *  beyond it the Protection Rate is improved.
 */

import type { Trade } from './types'

export type Side = 'LHS' | 'RHS'
export type Classification = 'Protect' | 'Participate' | 'Enhanced'
export type BarrierRole = 'knock-in' | 'knock-out' | 'target'

const EPS = 1e-6

/** Side from the product name; defaults to LHS (the common Convera book). */
export function sideOf(t: Trade): Side {
  return /\brhs\b/i.test(t.product) ? 'RHS' : 'LHS'
}

/** True when `spot` is the favourable side of reference rate `ref` for the client. */
export function isFavourable(side: Side, spot: number, ref: number): boolean {
  return side === 'LHS' ? spot > ref + EPS : spot < ref - EPS
}

/** The better / worse of two rates for the client, given the side. */
export function betterRate(side: Side, a: number, b: number): number {
  return side === 'LHS' ? Math.max(a, b) : Math.min(a, b)
}

const has = (t: Trade, re: RegExp) => re.test(t.product.toLowerCase())

export const isConvertible = (t: Trade) => has(t, /convertible|\bconv\b/)
export const isInverted = (t: Trade) => has(t, /inverted/)
export const isImprover = (t: Trade) => has(t, /improver/)
export const isCollarType = (t: Trade) => has(t, /collar/)
export const isParticipating = (t: Trade) => has(t, /participat/)

/**
 * Top-level classification (product list "Classification" column):
 *   • Protect     — guaranteed cover, no leverage (FEC, NDF, Vanilla, Collar,
 *                   Participator, …).
 *   • Participate — protection plus participation to a knock-in level.
 *   • Enhanced    — a better/enhanced rate that is conditional or leveraged
 *                   (Knock-Out, TARF, Ratio, Seagull, …).
 */
export function classify(t: Trade): Classification {
  const d = t.product.toLowerCase()
  if (t.leveraged) return 'Enhanced'
  if (/tarf|target|ratio|seagull|knock ?out|knock-out|capped|enhanced fec|accumulator/.test(d)) return 'Enhanced'
  if (/knock ?in|knock-in|improver|participat|extendib|dynamic/.test(d)) return 'Participate'
  return 'Protect'
}

/** True for structures carrying BOTH a knock-out and a knock-in barrier. */
function isDualBarrier(t: Trade): boolean {
  const d = t.product.toLowerCase()
  return /improver|kiko|dynamic/.test(d) || (/knock ?in/.test(d) && /knock ?out/.test(d))
}

/**
 * The role of a *specific* barrier level.
 *
 * On a dual-barrier structure (Knock-In Improver, KIKO, Dynamic) the level on
 * the unfavourable side of the protection rate is the knock-out and the level
 * on the favourable side is the knock-in — for an LHS trade, below P is the
 * knock-out and above P is the knock-in (RHS mirrors). Single-barrier products
 * take their role from the product name.
 */
export function roleForLevel(t: Trade, level: number): BarrierRole {
  const d = t.product.toLowerCase()
  if (/tarf|target/.test(d)) return 'target'
  if (isDualBarrier(t)) {
    const p = t.protectionStrike ?? level
    const aboveP = level > p + EPS
    const isKnockOut = sideOf(t) === 'LHS' ? !aboveP : aboveP
    return isKnockOut ? 'knock-out' : 'knock-in'
  }
  if (/knock ?out|knock-out/.test(d)) return 'knock-out'
  return 'knock-in' // knock-in, participating knock-in, single-barrier in-leg…
}

export interface BarrierVerdict {
  /** Breaching this barrier hurts the client (bad trigger). */
  adverse: boolean
  /** Whether it is breached at the given spot (assessed as if observable now). */
  breached: boolean
  /** Short human label, e.g. "Knock-in (bad)". */
  label: string
  role: BarrierRole
}

/**
 * Classify a single barrier level against the Rules of Barriers.
 * `spot` is the scenario rate; breach is assessed positionally (the observation
 * style — window / at-expiry / lifetime — is surfaced separately in the UI).
 */
export function classifyBarrier(t: Trade, level: number, spot: number): BarrierVerdict {
  const side = sideOf(t)
  const p = t.protectionStrike ?? level
  const role = roleForLevel(t, level)
  // A barrier is "breached" once spot is beyond it on the far side from P.
  const aboveP = level > p + EPS
  const breached = aboveP ? spot >= level - EPS : spot <= level + EPS

  if (role === 'knock-out') {
    // Convertible KO is a good trigger (turns into a vanilla); otherwise bad.
    const good = isConvertible(t)
    return { adverse: !good, breached, role, label: good ? 'Knock-out (good)' : 'Knock-out (bad)' }
  }

  if (role === 'target') {
    // TARF target/strike: being obligated at the enhanced rate is the risk.
    return { adverse: true, breached, role, label: 'Target barrier' }
  }

  // Knock-in. Standard KI sits on the favourable side of P and is a bad trigger
  // (kills participation → obligated at P). An inverted KI sits on the far side
  // and obligates at the enhanced rate — not adverse.
  const onFavourableSide = side === 'LHS' ? aboveP : !aboveP
  const inverted = isInverted(t) || !onFavourableSide
  if (inverted) {
    return { adverse: false, breached, role, label: 'Inverted knock-in' }
  }
  return { adverse: true, breached, role, label: 'Knock-in (bad)' }
}
