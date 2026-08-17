import { useEffect, useState } from 'react'
import type { TradeScenario } from '../../lib/scenario'
import { fmtDay, rate } from '../../lib/format'
import { STATUS, chartTokens, type Mode } from '../../theme'

/**
 * A rate "number line" for a single selected expiry: the protection rate plus
 * every barrier on that trade, positioned against the scenario spot. Scoping to
 * one trade keeps a multi-barrier structure (e.g. a knock-in improver, which
 * carries two knock-ins) fully legible instead of overlapping the whole book.
 */
export function BarrierMap({
  scenarios,
  spot,
  mode,
}: {
  scenarios: TradeScenario[]
  spot: number
  mode: Mode
}) {
  const t = chartTokens(mode)
  const [sel, setSel] = useState(0)
  // Keep the selection valid if the row set changes (strip ↔ full book).
  useEffect(() => {
    if (sel > scenarios.length - 1) setSel(0)
  }, [scenarios.length, sel])

  const scen = scenarios[Math.min(sel, scenarios.length - 1)]
  if (!scen) return null
  const prot = scen.trade.protectionStrike

  // Frame the axis around this trade's own levels + spot, with padding.
  const levels = [spot, ...(prot != null ? [prot] : []), ...scen.barriers.map((b) => b.level)]
  const lo = Math.min(...levels)
  const hi = Math.max(...levels)
  const pad = Math.max((hi - lo) * 0.25, 0.004)
  const min = lo - pad
  const max = hi + pad

  const W = 960
  const H = 150
  const padX = 34
  const axisY = 104
  const x = (v: number) => padX + ((v - min) / (max - min)) * (W - padX * 2)

  const span = max - min
  const step = span > 0.08 ? 0.02 : span > 0.03 ? 0.01 : 0.005
  const ticks: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(4)))

  // Stagger barrier labels that sit close together so they don't collide.
  const sorted = scen.barriers
    .map((b, i) => ({ b, i, cx: x(b.level) }))
    .sort((a, z) => a.cx - z.cx)

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Expiry</span>
        <select
          value={sel}
          onChange={(e) => setSel(Number(e.target.value))}
          className="min-w-0 max-w-[320px] flex-1 rounded-md border border-line bg-surface-sunken px-2 py-1 text-xs text-ink focus:border-brand-400 outline-none"
        >
          {scenarios.map((s, i) => (
            <option key={s.trade.id} value={i}>
              {fmtDay(s.trade.expiry)} · {s.trade.family}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full overflow-x-auto scroll-thin">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[680px]" role="img" aria-label="Barrier map">
          {/* axis */}
          <line x1={padX} y1={axisY} x2={W - padX} y2={axisY} stroke={t.grid} strokeWidth={2} />
          {ticks.map((tv) => (
            <g key={tv}>
              <line x1={x(tv)} y1={axisY} x2={x(tv)} y2={axisY + 5} stroke={t.axis} strokeWidth={1} />
              <text x={x(tv)} y={axisY + 18} textAnchor="middle" fontSize="10" fill={t.axis}>
                {rate(tv)}
              </text>
            </g>
          ))}

          {/* protection rate */}
          {prot != null && (
            <g>
              <line x1={x(prot)} y1={axisY} x2={x(prot)} y2={38} stroke={STATUS.warning} strokeWidth={1.5} strokeDasharray="3 3" />
              <rect x={x(prot) - 30} y={24} width={60} height={15} rx={3} fill={STATUS.warning} />
              <text x={x(prot)} y={35} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#3a2a00">
                Prot {rate(prot)}
              </text>
            </g>
          )}

          {/* spot marker */}
          <line x1={x(spot)} y1={axisY} x2={x(spot)} y2={8} stroke={t.ink} strokeWidth={1.5} />
          <rect x={x(spot) - 26} y={6} width={52} height={15} rx={3} fill={t.ink} />
          <text x={x(spot)} y={17} textAnchor="middle" fontSize="10" fontWeight="600" fill={t.surface}>
            {rate(spot)}
          </text>

          {/* barriers */}
          {sorted.map(({ b, cx }, k) => {
            const color = b.adverse ? STATUS.critical : STATUS.good
            const labelY = axisY - 40 - (k % 2) * 15
            return (
              <g key={k}>
                <line x1={cx} y1={axisY} x2={cx} y2={axisY - 20} stroke={color} strokeWidth={1.5} opacity={b.breached ? 1 : 0.8} />
                <circle cx={cx} cy={axisY - 24} r={5} fill={b.breached ? color : t.surface} stroke={color} strokeWidth={2} />
                <line x1={cx} y1={axisY - 29} x2={cx} y2={labelY + 3} stroke={color} strokeWidth={0.75} strokeDasharray="2 2" opacity={0.5} />
                <text
                  x={Math.min(Math.max(cx, 54), W - 54)}
                  y={labelY}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill={t.ink}
                >
                  {b.label} · {rate(b.level)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS.warning }} /> Protection rate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS.critical }} /> Bad trigger
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS.good }} /> Good / benign trigger
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full border-2" style={{ borderColor: t.axis }} /> Filled = breached
        </span>
      </div>
    </div>
  )
}
