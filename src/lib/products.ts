/**
 * Presentation metadata for the four top-level product categories.
 * The category label is shared by the ledger pills, the product make-up donut
 * and the credit bar; the identity colour lives in theme.ts (categoryColor) so
 * a category always reads the same across the dashboard.
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
