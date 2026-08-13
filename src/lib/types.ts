/**
 * Domain model for a hedge portfolio.
 *
 * Two tables come out of the source workbook:
 *   1. A monthly obligation timeline (one row per calendar month).
 *   2. A trade-detail ledger (one row per hedge line / expiry).
 * Both are parsed from a plain copy-paste of the sheet — see lib/parse.ts.
 */

/** One month of aggregated protection / obligation figures. */
export interface MonthlyPoint {
  /** First of the month. */
  month: Date
  forecast: number | null
  protection: number
  currentObligation: number
  potentialObligation: number
  maxObligation: number
  /** Weighted average protection rate for the month, or null when no cover. */
  avgRate: number | null
}

/** Broad product family, derived from the free-text product description. */
export type ProductFamily =
  | 'Forward'
  | 'Vanilla Option'
  | 'Participating Forward'
  | 'Knock-In'
  | 'Knock-Out'
  | 'TARF'
  | 'Other'

/** One hedge line item (a single expiry of a trade). */
export interface Trade {
  id: string
  expiry: Date
  forecast: number | null
  protection: number
  currentObligation: number
  potentialObligation: number
  maxObligation: number
  ccy: string
  /** Full product description as it appears in the source tool. */
  product: string
  family: ProductFamily
  /** True when the product gears up the obligation beyond the protected amount. */
  leveraged: boolean
  protectionStrike: number | null
  participationStrike: number | null
  strikeI: number | null
  strikeII: number | null
  /** Primary barrier / trigger level. */
  trigger: number | null
  windowStart: Date | null
  windowEnd: Date | null
  windowLength: string | null
  /** Secondary barrier / trigger level. */
  trigger2: number | null
  window2Start: Date | null
  window2End: Date | null
  window2Length: string | null
  ticket: string | null
  tradeDate: Date | null
  comment: string | null
  credit: number | null
}

/** The full parsed portfolio. */
export interface Portfolio {
  monthly: MonthlyPoint[]
  trades: Trade[]
  /** Currency pair the book is quoted in, e.g. "AUD/USD". */
  pair: string
  /** When the paste was imported. */
  importedAt: string
  /** Free-form label the user can attach to a paste (e.g. client name). */
  label?: string
}

/** Result of parsing a paste. */
export interface ParseResult {
  portfolio: Portfolio | null
  warnings: string[]
  errors: string[]
  /** Rows detected for each table, for the import preview. */
  stats: { monthlyRows: number; tradeRows: number }
}
