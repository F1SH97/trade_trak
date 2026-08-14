import { useMemo, useState } from 'react'
import type { Trade } from '../lib/types'
import { fmtDay, rate, relativeDays, usd } from '../lib/format'
import { CATEGORY_LABEL, CATEGORY_PILL } from '../lib/products'
import { startOfDay } from '../lib/format'

type SortKey = 'expiry' | 'protection' | 'maxObligation' | 'credit'

/** The product name for the pill — source description minus the "Leveraged"
 *  prefix (surfaced separately as a flag) and the LHS/RHS side tag. */
function productName(product: string): string {
  return product
    .replace(/\((?:LHS|RHS)\)/gi, '')
    .replace(/\bleveraged\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split a trade's barrier levels into a low / high pair for the two trigger columns. */
function triggerPair(t: Trade): { low: number | null; high: number | null } {
  const levels = [t.trigger, t.trigger2].filter((x): x is number => x != null)
  if (levels.length >= 2) return { low: Math.min(...levels), high: Math.max(...levels) }
  if (levels.length === 1) {
    const only = levels[0]
    // A lone barrier sitting above the protection strike reads as the high trigger.
    if (t.protectionStrike != null && only > t.protectionStrike) return { low: null, high: only }
    return { low: only, high: null }
  }
  return { low: null, high: null }
}

/** The at-a-glance trade ledger. Compact, sortable, expiry-aware. */
export function TradeTable({ trades, dense = false }: { trades: Trade[]; dense?: boolean }) {
  const [sort, setSort] = useState<SortKey>('expiry')
  const [dir, setDir] = useState<1 | -1>(1)
  const now = startOfDay(new Date())

  const rows = useMemo(() => {
    const val = (t: Trade) =>
      sort === 'expiry' ? t.expiry.getTime() : sort === 'credit' ? (t.credit ?? 0) : t[sort]
    return [...trades].sort((a, b) => (val(a) - val(b)) * dir)
  }, [trades, sort, dir])

  const th = (key: SortKey, label: string, align = 'right') => (
    <th
      className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 text-${align} font-semibold text-ink-soft hover:text-ink`}
      onClick={() => {
        if (sort === key) setDir((d) => (d === 1 ? -1 : 1))
        else {
          setSort(key)
          setDir(1)
        }
      }}
    >
      {label}
      {sort === key && <span className="ml-1 text-ink-muted">{dir === 1 ? '▲' : '▼'}</span>}
    </th>
  )

  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full min-w-[900px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide">
            {th('expiry', 'Expiry', 'left')}
            <th className="px-3 py-2 text-left font-semibold text-ink-soft">Product</th>
            <th className="px-3 py-2 text-left font-semibold text-ink-soft">CCY</th>
            {th('protection', 'Protection')}
            <th className="px-3 py-2 text-right font-semibold text-ink-soft">Strike</th>
            <th className="px-3 py-2 text-right font-semibold text-ink-soft">Low Trigger</th>
            <th className="px-3 py-2 text-right font-semibold text-ink-soft">High Trigger</th>
            {th('maxObligation', 'Max oblig.')}
            {th('credit', 'Credit')}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const expired = t.expiry < now
            return (
              <tr
                key={t.id}
                className={`border-b border-line/60 transition-colors hover:bg-surface-sunken ${
                  dense ? '' : ''
                } ${expired ? 'opacity-45' : ''}`}
              >
                <td className="whitespace-nowrap px-3 py-2">
                  <div className="font-medium text-ink">{fmtDay(t.expiry)}</div>
                  {!expired && <div className="text-[10px] text-ink-muted">{relativeDays(t.expiry)}</div>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5" title={t.product}>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${CATEGORY_PILL[t.category]}`}
                    >
                      {productName(t.product)}
                    </span>
                    {t.leveraged && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">leveraged</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-muted">{CATEGORY_LABEL[t.category]}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-ink-soft">{t.ccy}</td>
                <td className="tnum whitespace-nowrap px-3 py-2 text-right font-medium text-ink">{usd(t.protection)}</td>
                <td className="tnum whitespace-nowrap px-3 py-2 text-right text-ink-soft">{rate(t.protectionStrike)}</td>
                {(() => {
                  const { low, high } = triggerPair(t)
                  return (
                    <>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-right text-ink-soft">{low != null ? rate(low) : '—'}</td>
                      <td className="tnum whitespace-nowrap px-3 py-2 text-right text-ink-soft">{high != null ? rate(high) : '—'}</td>
                    </>
                  )
                })()}
                <td className="tnum whitespace-nowrap px-3 py-2 text-right text-ink-soft">{usd(t.maxObligation)}</td>
                <td className="tnum whitespace-nowrap px-3 py-2 text-right text-ink-soft">{usd(t.credit)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
