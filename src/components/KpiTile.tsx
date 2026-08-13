/** Headline stat tile for the Overview KPI row. */

import type { ReactNode } from 'react'

export function KpiTile({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string
  value: string
  sub?: ReactNode
  /** Optional left accent bar colour. */
  accent?: string
  icon?: ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-card">
      {accent && <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} aria-hidden />}
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
        {icon && <span className="text-ink-muted">{icon}</span>}
      </div>
      <p className="tnum mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {sub && <div className="tnum mt-1 text-xs text-ink-soft">{sub}</div>}
    </div>
  )
}
