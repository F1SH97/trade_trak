/** Shared chart chrome: themed tooltip + axis token helpers. */

import type { ReactNode } from 'react'
import { chartTokens, currentMode } from '../../theme'

export function useChartTokens() {
  return chartTokens(currentMode())
}

interface TipRow {
  label: string
  value: string
  color?: string
}

/** A consistent tooltip card used by every chart. */
export function TooltipCard({ title, rows, footer }: { title?: string; rows: TipRow[]; footer?: ReactNode }) {
  const t = chartTokens(currentMode())
  return (
    <div
      className="tnum rounded-lg border px-3 py-2 text-xs shadow-pop"
      style={{ background: t.tooltipBg, borderColor: t.tooltipBorder, color: t.ink }}
    >
      {title && <div className="mb-1 font-semibold">{title}</div>}
      <div className="space-y-0.5">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5" style={{ color: t.inkSoft }}>
              {r.color && <span className="inline-block h-2 w-2 rounded-sm" style={{ background: r.color }} />}
              {r.label}
            </span>
            <span className="font-medium tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
      {footer && (
        <div className="mt-1 border-t pt-1 text-[11px]" style={{ borderColor: t.tooltipBorder, color: t.inkSoft }}>
          {footer}
        </div>
      )}
    </div>
  )
}

export const axisProps = (mode = currentMode()) => {
  const t = chartTokens(mode)
  return {
    tick: { fill: t.axis, fontSize: 11 },
    axisLine: { stroke: t.grid },
    tickLine: { stroke: t.grid },
  }
}
