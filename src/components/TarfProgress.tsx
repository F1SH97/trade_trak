import type { TarfProgress } from '../lib/tarf'
import { rate } from '../lib/format'
import { STATUS } from '../theme'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/**
 * Target-accrual reading for a TARF: how much of the target has accrued and how
 * much is left before it knocks out. Points TARFs read in points; count / fixing
 * TARFs read in counts. Compact enough for a table cell, legible on its own.
 */
export function TarfProgressBar({ p, className = '' }: { p: TarfProgress; className?: string }) {
  const pctUsed = Math.round(p.fraction * 100)
  // Closer to the target = closer to knock-out: warn as it fills up.
  const bar = p.fraction >= 0.85 ? STATUS.serious : p.fraction >= 0.6 ? STATUS.warning : STATUS.good

  return (
    <div className={`w-full max-w-[200px] ${className}`}>
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-medium text-ink">
          {fmt(p.remaining)} <span className="font-normal text-ink-muted">{p.label.toLowerCase()} left</span>
        </span>
        <span className="tnum text-[10px] text-ink-muted">
          {fmt(p.used)}/{fmt(p.total)}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, pctUsed))}%`, background: bar }} />
      </div>
      <div className="mt-0.5 text-[10px] text-ink-muted">
        {pctUsed}% to target{p.level != null ? ` · knocks < ${rate(p.level)}` : ''}
      </div>
    </div>
  )
}
