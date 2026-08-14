import type { ProductSlice } from '../../lib/analytics'
import { pct, usd, usdCompact } from '../../lib/format'
import { CATEGORY_LABEL } from '../../lib/products'
import { categorical, categoryColor, STATUS, type Mode } from '../../theme'

/** Credit utilisation meter + a segmented breakdown of credit by product. */
export function CreditBar({
  used,
  limit,
  segments,
  mode,
}: {
  used: number
  limit: number | null
  segments: ProductSlice[]
  mode: Mode
}) {
  const palette = categorical(mode)
  const util = limit && limit > 0 ? used / limit : null
  const barColor =
    util == null ? palette[0] : util >= 1 ? STATUS.critical : util >= 0.85 ? STATUS.serious : util >= 0.65 ? STATUS.warning : STATUS.good

  return (
    <div className="space-y-4">
      {/* Utilisation meter */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="tnum text-2xl font-semibold text-ink">{util != null ? pct(util, 0) : usdCompact(used)}</span>
          <span className="tnum text-xs text-ink-muted">
            {limit ? `${usdCompact(used)} of ${usdCompact(limit)}` : 'in use'}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-sunken">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, util != null ? util * 100 : 100)}%`, background: barColor }}
          />
        </div>
        {limit != null && (
          <p className="tnum mt-1 text-xs text-ink-muted">
            {util != null && util < 1 ? `${usdCompact(limit - used)} headroom` : 'Limit reached'}
          </p>
        )}
      </div>

      {/* Segmented breakdown by product */}
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">By product</div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full">
          {segments.map((s) => (
            <div
              key={s.category}
              title={`${CATEGORY_LABEL[s.category]}: ${usd(s.credit)}`}
              style={{ width: `${(s.credit / (used || 1)) * 100}%`, background: categoryColor(s.category, mode) }}
            />
          ))}
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          {segments.map((s) => (
            <li key={s.category} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-ink-soft">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: categoryColor(s.category, mode) }} />
                {CATEGORY_LABEL[s.category]}
              </span>
              <span className="tnum font-medium text-ink">{usdCompact(s.credit)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
