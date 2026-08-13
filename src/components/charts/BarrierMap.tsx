import { useState } from 'react'
import type { TradeScenario } from '../../lib/scenario'
import { rate } from '../../lib/format'
import { STATUS, chartTokens, type Mode } from '../../theme'

interface Marker {
  level: number
  adverse: boolean
  breached: boolean
  label: string
  product: string
}

/**
 * A rate "number line" showing every live barrier relative to the scenario
 * spot. Barriers below spot that are adverse are the ones to worry about.
 */
export function BarrierMap({
  scenarios,
  spot,
  min,
  max,
  mode,
}: {
  scenarios: TradeScenario[]
  spot: number
  min: number
  max: number
  mode: Mode
}) {
  const t = chartTokens(mode)
  const [hover, setHover] = useState<number | null>(null)

  const markers: Marker[] = []
  for (const s of scenarios) {
    for (const b of s.barriers) {
      markers.push({
        level: b.level,
        adverse: b.adverse,
        breached: b.breached,
        label: b.label,
        product: s.trade.product,
      })
    }
  }

  const W = 720
  const H = 132
  const padX = 24
  const axisY = 92
  const x = (v: number) => padX + ((v - min) / (max - min)) * (W - padX * 2)

  // Grid ticks every 0.01–0.02 depending on span.
  const span = max - min
  const step = span > 0.15 ? 0.02 : 0.01
  const ticks: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(4)))

  return (
    <div className="w-full overflow-x-auto scroll-thin">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Barrier map">
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

        {/* spot marker */}
        <line x1={x(spot)} y1={22} x2={x(spot)} y2={axisY} stroke={t.ink} strokeWidth={1.5} />
        <rect x={x(spot) - 26} y={6} width={52} height={16} rx={3} fill={t.ink} />
        <text x={x(spot)} y={18} textAnchor="middle" fontSize="10" fontWeight="600" fill={t.surface}>
          {rate(spot)}
        </text>

        {/* barriers */}
        {markers.map((m, i) => {
          const color = m.adverse ? STATUS.critical : STATUS.good
          const cx = x(m.level)
          const active = hover === i
          return (
            <g
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            >
              <line x1={cx} y1={axisY} x2={cx} y2={axisY - 20} stroke={color} strokeWidth={active ? 2.5 : 1.5} opacity={m.breached ? 1 : 0.75} />
              <circle
                cx={cx}
                cy={axisY - 24}
                r={active ? 6 : 4.5}
                fill={m.breached ? color : t.surface}
                stroke={color}
                strokeWidth={2}
              />
            </g>
          )
        })}

        {/* hover label */}
        {hover != null && markers[hover] && (
          <g>
            <text
              x={Math.min(Math.max(x(markers[hover].level), 70), W - 70)}
              y={axisY - 40}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill={t.ink}
            >
              {markers[hover].label} · {rate(markers[hover].level)}
            </text>
            <text
              x={Math.min(Math.max(x(markers[hover].level), 90), W - 90)}
              y={axisY - 27}
              textAnchor="middle"
              fontSize="10"
              fill={t.inkSoft}
            >
              {markers[hover].product.slice(0, 46)}
            </text>
          </g>
        )}
      </svg>
      <div className="mt-1 flex items-center gap-4 px-1 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS.critical }} /> Adverse barrier
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: STATUS.good }} /> Upside / benign
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full border-2" style={{ borderColor: t.axis }} /> Not yet breached
        </span>
      </div>
    </div>
  )
}
