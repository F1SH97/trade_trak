/**
 * Paste parser.
 *
 * Turns a raw copy-paste of the source workbook into a typed Portfolio.
 * The sheet holds two stacked tables (a monthly timeline and a trade ledger);
 * we locate each by its header row and map columns by NAME, so the parser is
 * tolerant of extra leading/spacer columns and minor column re-ordering.
 *
 * Excel puts in-cell line breaks inside double-quoted fields, so a naive
 * split on "\n" would tear headers apart — we run a proper delimited-field
 * tokenizer first.
 */

import type { MonthlyPoint, ParseResult, Portfolio, ProductCategory, ProductFamily, Trade } from './types'

/* ----------------------------- tokenizer ------------------------------ */

/** Parse delimited text (tab preferred, comma fallback) into a grid of cells,
 *  honouring double-quoted fields with embedded delimiters/newlines. */
function toGrid(text: string): string[][] {
  const delim = text.includes('\t') ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === delim) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch === '\r') {
      // ignore — CRLF handled by the \n branch
    } else {
      cell += ch
    }
  }
  row.push(cell)
  rows.push(row)
  return rows
}

/* --------------------------- value parsing ---------------------------- */

/** Collapse whitespace (incl. embedded newlines) and lowercase for matching. */
function normHeader(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\(usd\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const BLANK = new Set(['', '-', '–', '—', 'n/a', 'na'])

/** Numbers may arrive as "637,500", "$1,000,000", "0.6350", "-" or blank. */
export function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null
  const s = raw.replace(/[,$\s]/g, '').trim()
  if (BLANK.has(s.toLowerCase())) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

/** Flexible date parser: "01 Aug 26 (Sat)", "17 Aug 26 06:00",
 *  "2026-08-01", "1/08/2026" (day-first). */
export function parseDate(raw: string | undefined): Date | null {
  if (raw == null) return null
  let s = raw.trim()
  if (BLANK.has(s.toLowerCase())) return null
  // drop weekday in parentheses
  s = s.replace(/\([^)]*\)/g, '').trim()
  // capture optional trailing time
  let hh = 0
  let mm = 0
  const tm = s.match(/(\d{1,2}):(\d{2})/)
  if (tm) {
    hh = Number(tm[1])
    mm = Number(tm[2])
    s = s.replace(tm[0], '').trim()
  }

  // "01 Aug 26" / "1 August 2026"
  let m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2,4})$/)
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()]
    if (mon != null) return build(Number(m[3]), mon, Number(m[1]), hh, mm)
  }
  // ISO "2026-08-01"
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return build(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh, mm)
  // "1/08/2026" — day-first (source tool is en-AU/en-GB)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) return build(Number(m[3]), Number(m[2]) - 1, Number(m[1]), hh, mm)

  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t)
}

function build(year: number, monthIdx: number, day: number, hh: number, mm: number): Date {
  if (year < 100) year += 2000
  return new Date(year, monthIdx, day, hh, mm)
}

/* --------------------------- table location --------------------------- */

/** Build header → column-index map. For repeated headers (window start/end/
 *  length appear twice), all indices are recorded in order. */
function headerMap(cells: string[]): Map<string, number[]> {
  const map = new Map<string, number[]>()
  cells.forEach((c, i) => {
    const key = normHeader(c)
    if (!key) return
    const arr = map.get(key)
    if (arr) arr.push(i)
    else map.set(key, [i])
  })
  return map
}

function first(map: Map<string, number[]>, key: string): number | undefined {
  return map.get(key)?.[0]
}

function isMonthlyHeader(cells: string[]): boolean {
  const set = new Set(cells.map(normHeader))
  return set.has('month') && set.has('protection')
}

function isTradeHeader(cells: string[]): boolean {
  const set = new Set(cells.map(normHeader))
  return set.has('expiry') && set.has('product')
}

/* ------------------------------ product ------------------------------- */

export function classifyProduct(desc: string): {
  family: ProductFamily
  category: ProductCategory
  leveraged: boolean
} {
  const d = desc.toLowerCase()
  const leveraged = /leverag|geared|tarf|target|ratio/.test(d)

  // Granular family — drives the scenario engine.
  let family: ProductFamily = 'Other'
  if (/tarf|target accrual/.test(d)) family = 'TARF'
  else if (/improver/.test(d)) family = 'Knock-In Improver'
  else if (/knock ?in|knock-in/.test(d)) family = 'Knock-In'
  else if (/knock ?out|knock-out/.test(d)) family = 'Knock-Out'
  else if (/participat/.test(d)) family = 'Participating Forward'
  else if (/\bfec\b|forward|outright/.test(d)) family = 'Forward'
  else if (/call|put|vanilla|collar|option/.test(d)) family = 'Vanilla Option'

  // Top-level category — the four Convera buckets. Only three are named
  // explicitly; Option is the catch-all for everything else:
  //   • TARF    — any product with "tarf" in the name.
  //   • NDF     — non-deliverable forwards only.
  //   • Forward — FEC and synthetic FEC only (nothing else).
  //   • Option  — anything that is none of the above.
  let category: ProductCategory = 'Option'
  if (/tarf/.test(d)) category = 'TARF'
  else if (/\bndf\b|non.?deliverable/.test(d)) category = 'NDF'
  else if (/\bfec\b|synthetic\s+(?:fec|forward)/.test(d)) category = 'Forward'

  return { family, category, leveraged }
}

/* ------------------------------ parse --------------------------------- */

export function parsePaste(text: string, label?: string): ParseResult {
  const warnings: string[] = []
  const errors: string[] = []

  if (!text || !text.trim()) {
    return {
      portfolio: null,
      warnings,
      errors: ['Nothing to parse — paste the hedge summary from the workbook first.'],
      stats: { monthlyRows: 0, tradeRows: 0 },
    }
  }

  const grid = toGrid(text)

  let monthlyHeaderIdx = -1
  let tradeHeaderIdx = -1
  grid.forEach((cells, i) => {
    if (monthlyHeaderIdx < 0 && isMonthlyHeader(cells)) monthlyHeaderIdx = i
    if (tradeHeaderIdx < 0 && isTradeHeader(cells)) tradeHeaderIdx = i
  })

  const monthly: MonthlyPoint[] = []
  if (monthlyHeaderIdx >= 0) {
    const map = headerMap(grid[monthlyHeaderIdx])
    const cMonth = first(map, 'month')
    const cForecast = first(map, 'forecast')
    const cProt = first(map, 'protection')
    const cCur = first(map, 'current obligation')
    const cPot = first(map, 'potential obligation')
    const cMax = first(map, 'max potential obligation')
    const cRate = first(map, 'average protection rate')

    const end = tradeHeaderIdx > monthlyHeaderIdx ? tradeHeaderIdx : grid.length
    for (let r = monthlyHeaderIdx + 1; r < end; r++) {
      const row = grid[r]
      const month = parseDate(cMonth != null ? row[cMonth] : undefined)
      if (!month) continue // stops at the total / blank rows
      monthly.push({
        month,
        forecast: cForecast != null ? parseNumber(row[cForecast]) : null,
        protection: parseNumber(cProt != null ? row[cProt] : undefined) ?? 0,
        currentObligation: parseNumber(cCur != null ? row[cCur] : undefined) ?? 0,
        potentialObligation: parseNumber(cPot != null ? row[cPot] : undefined) ?? 0,
        maxObligation: parseNumber(cMax != null ? row[cMax] : undefined) ?? 0,
        avgRate: cRate != null ? parseNumber(row[cRate]) : null,
      })
    }
  }

  const trades: Trade[] = []
  let pair = ''
  if (tradeHeaderIdx >= 0) {
    const map = headerMap(grid[tradeHeaderIdx])
    const cExpiry = first(map, 'expiry')
    const cForecast = first(map, 'forecast')
    const cProt = first(map, 'protection')
    const cCur = first(map, 'current obligation')
    const cPot = first(map, 'potential obligation')
    const cMax = first(map, 'max potential obligation')
    const cCcy = first(map, 'ccy')
    const cProduct = first(map, 'product')
    const cPStrike = first(map, 'protection strike')
    const cPartStrike = first(map, 'participation strike')
    const cStrikeI = first(map, 'strike (i)')
    const cStrikeII = first(map, 'strike (ii)')
    const cTrigger = first(map, 'trigger')
    const cTrigger2 = first(map, 'trigger 2')
    const winStart = map.get('window start date') ?? []
    const winEnd = map.get('window end date') ?? []
    const winLen = map.get('window length') ?? []
    const cTicket = first(map, 'ticket number')
    const cTradeDate = first(map, 'trade date')
    const cComment = first(map, 'comment / ref') ?? first(map, 'comment')
    const cCredit = first(map, 'credit')

    for (let r = tradeHeaderIdx + 1; r < grid.length; r++) {
      const row = grid[r]
      const expiry = parseDate(cExpiry != null ? row[cExpiry] : undefined)
      if (!expiry) continue
      const product = (cProduct != null ? row[cProduct] : '')?.trim() || 'Unknown'
      const { family, category, leveraged } = classifyProduct(product)
      const ccy = (cCcy != null ? row[cCcy] : '')?.trim() || ''
      if (ccy && !pair) pair = ccy
      trades.push({
        id: `t${r}`,
        expiry,
        forecast: cForecast != null ? parseNumber(row[cForecast]) : null,
        protection: parseNumber(cProt != null ? row[cProt] : undefined) ?? 0,
        currentObligation: parseNumber(cCur != null ? row[cCur] : undefined) ?? 0,
        potentialObligation: parseNumber(cPot != null ? row[cPot] : undefined) ?? 0,
        maxObligation: parseNumber(cMax != null ? row[cMax] : undefined) ?? 0,
        ccy,
        product,
        family,
        category,
        leveraged,
        protectionStrike: parseNumber(cPStrike != null ? row[cPStrike] : undefined),
        participationStrike: parseNumber(cPartStrike != null ? row[cPartStrike] : undefined),
        strikeI: parseNumber(cStrikeI != null ? row[cStrikeI] : undefined),
        strikeII: parseNumber(cStrikeII != null ? row[cStrikeII] : undefined),
        trigger: parseNumber(cTrigger != null ? row[cTrigger] : undefined),
        windowStart: parseDate(winStart[0] != null ? row[winStart[0]] : undefined),
        windowEnd: parseDate(winEnd[0] != null ? row[winEnd[0]] : undefined),
        windowLength: cellText(row, winLen[0]),
        trigger2: parseNumber(cTrigger2 != null ? row[cTrigger2] : undefined),
        window2Start: parseDate(winStart[1] != null ? row[winStart[1]] : undefined),
        window2End: parseDate(winEnd[1] != null ? row[winEnd[1]] : undefined),
        window2Length: cellText(row, winLen[1]),
        ticket: cellText(row, cTicket),
        tradeDate: parseDate(cTradeDate != null ? row[cTradeDate] : undefined),
        comment: cellText(row, cComment),
        credit: parseNumber(cCredit != null ? row[cCredit] : undefined),
      })
    }
  }

  if (monthlyHeaderIdx < 0 && tradeHeaderIdx < 0) {
    errors.push(
      "Couldn't find a hedge summary in the pasted text. Make sure you copy the whole sheet — the parser looks for the 'Month' timeline and the 'Expiry / Product' trade table.",
    )
    return { portfolio: null, warnings, errors, stats: { monthlyRows: 0, tradeRows: 0 } }
  }

  if (tradeHeaderIdx < 0) warnings.push('No trade-detail table found — only the monthly timeline was imported.')
  if (monthlyHeaderIdx < 0 && trades.length) {
    warnings.push('No monthly timeline found — a timeline was derived from trade expiries.')
    monthly.push(...deriveMonthly(trades))
  }
  if (trades.length === 0 && monthly.length === 0) {
    errors.push('Found the headers but no data rows. Check that the figures were included in the copy.')
    return { portfolio: null, warnings, errors, stats: { monthlyRows: 0, tradeRows: 0 } }
  }

  const portfolio: Portfolio = {
    monthly: monthly.sort((a, b) => a.month.getTime() - b.month.getTime()),
    trades: trades.sort((a, b) => a.expiry.getTime() - b.expiry.getTime()),
    pair: pair || 'AUD/USD',
    importedAt: new Date().toISOString(),
    label,
  }
  return {
    portfolio,
    warnings,
    errors,
    stats: { monthlyRows: monthly.length, tradeRows: trades.length },
  }
}

function cellText(row: string[], idx: number | undefined): string | null {
  if (idx == null) return null
  const v = (row[idx] ?? '').trim()
  return v || null
}

/** Fallback: bucket trade figures by expiry month when no timeline is present. */
function deriveMonthly(trades: Trade[]): MonthlyPoint[] {
  const buckets = new Map<number, MonthlyPoint>()
  for (const t of trades) {
    const key = new Date(t.expiry.getFullYear(), t.expiry.getMonth(), 1).getTime()
    let b = buckets.get(key)
    if (!b) {
      b = {
        month: new Date(key),
        forecast: null,
        protection: 0,
        currentObligation: 0,
        potentialObligation: 0,
        maxObligation: 0,
        avgRate: null,
      }
      buckets.set(key, b)
    }
    b.protection += t.protection
    b.currentObligation += t.currentObligation
    b.potentialObligation += t.potentialObligation
    b.maxObligation += t.maxObligation
  }
  return [...buckets.values()]
}
