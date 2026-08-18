/**
 * Comment / notes parsing.
 *
 * The source workbook records a TARF's running target-accrual balance in the
 * free-text "Comment / Ref" column, e.g.
 *
 *   "Points remaining: 705.5 of 800 (< 0.60445) [fff]"
 *   "Counts remaining: 3 of 12"
 *
 * We surface that as a structured progress reading (points TARFs) or a count
 * reading (count / fixing TARFs), plus a cleaned freeform note for anything
 * else the column carries. Nothing here is inferred from product mechanics —
 * it only reads what the note actually says.
 */

export type TarfKind = 'points' | 'counts'

export interface TarfProgress {
  kind: TarfKind
  /** Units still to accrue before the target is reached (the TARF knocks out). */
  remaining: number
  /** The target total. */
  total: number
  /** Units already accrued (total − remaining). */
  used: number
  /** Fraction of the target reached, 0..1. */
  fraction: number
  /** Optional knock level quoted in the note, e.g. "(< 0.60445)". */
  level?: number
  /** "Points" | "Counts" — for the label. */
  label: string
}

const toNum = (s: string) => Number(s.replace(/,/g, ''))

function knockLevel(c: string): number | undefined {
  const m = c.match(/[<>]\s*=?\s*([\d.]+)/)
  return m ? Number(m[1]) : undefined
}

function build(kind: TarfKind, remaining: number, total: number, level: number | undefined): TarfProgress | null {
  if (!Number.isFinite(remaining) || !Number.isFinite(total) || total <= 0) return null
  const clampedRemaining = Math.max(0, Math.min(remaining, total))
  const used = total - clampedRemaining
  return {
    kind,
    remaining: clampedRemaining,
    total,
    used,
    fraction: used / total,
    level,
    label: kind === 'points' ? 'Points' : 'Counts',
  }
}

/**
 * Extract a TARF target-accrual reading from a comment, if present. Recognises
 * both "<label> ... N of M" and "N of M <label>" orderings, for points/target/
 * pips (points TARFs) and counts/fixings (count TARFs).
 */
export function parseTarfProgress(comment?: string | null): TarfProgress | null {
  if (!comment) return null
  const c = comment

  const countLabel = /counts?|fixings?/i
  const pointLabel = /points?|target|pips?/i
  const pair = /([\d,.]+)\s*(?:of|\/|out of)\s*([\d,.]+)/i

  // Counts / fixings — label before or after the "N of M".
  let m = c.match(new RegExp(`(?:${countLabel.source})[^\\d]*${pair.source}`, 'i'))
  if (m) return build('counts', toNum(m[1]), toNum(m[2]), knockLevel(c))
  m = c.match(new RegExp(`${pair.source}\\s*(?:${countLabel.source})`, 'i'))
  if (m) return build('counts', toNum(m[1]), toNum(m[2]), knockLevel(c))

  // Points / target / pips.
  m = c.match(new RegExp(`(?:${pointLabel.source})[^\\d]*${pair.source}`, 'i'))
  if (m) return build('points', toNum(m[1]), toNum(m[2]), knockLevel(c))
  m = c.match(new RegExp(`${pair.source}\\s*(?:${pointLabel.source})`, 'i'))
  if (m) return build('points', toNum(m[1]), toNum(m[2]), knockLevel(c))

  return null
}

/**
 * A display-ready note: the comment with internal bracket tags (e.g. "[fff]")
 * removed and whitespace collapsed. Returns null when nothing meaningful is
 * left, so callers can hide the field entirely.
 */
export function cleanNote(comment?: string | null): string | null {
  if (!comment) return null
  const s = comment.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()
  return s || null
}
