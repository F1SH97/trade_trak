/**
 * Presentation metadata for the four top-level product categories.
 * Shared by the ledger pills, the product make-up donut and the credit bar so
 * a category always reads in the same colour and wording across the dashboard.
 *
 * Palette note: categories use only positive / neutral hues (blue, indigo,
 * teal, pink, slate) — never red or amber — so colour never implies risk.
 */

import type { ProductCategory } from './types'

/** Grey sub-label shown under each pill / used in chart legends. */
export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  Forward: 'Forward',
  Option: 'Option',
  TARF: 'TARF',
  NDF: 'Non-Deliverable Forward',
  Other: 'Other',
}

/** Tailwind classes for the ledger pill fill, one hue per category. */
export const CATEGORY_PILL: Record<ProductCategory, string> = {
  Forward:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30',
  Option:
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/30',
  TARF: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/30',
  NDF: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/30',
  Other:
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/30',
}
