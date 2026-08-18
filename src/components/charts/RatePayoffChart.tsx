import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RatePoint } from '../../lib/scenario'
import { rate } from '../../lib/format'
import { categorical, chartTokens, STATUS, type Mode } from '../../theme'
import { TooltipCard, axisProps } from './common'

/**
 * Effective-rate-vs-market payoff. The market diagonal is where you'd transact
 * unhedged; the solid line is the rate the book actually locks in at each spot.
 * Works for every product: a forward is a flat locked line, a TARF locks then
 * gears, a knock-in improver tracks the market then drops to protection. The
 * shaded gap between the two lines is what the structure is worth at that rate.
 */
export function RatePayoffChart({
  data,
  spot,
  protection = [],
  barriers = [],
  mode,
  leveraged = false,
  heightClass = 'h-72',
}: {
  data: RatePoint[]
  spot: number
  protection?: number[]
  barriers?: { level: number; adverse: boolean }[]
  mode: Mode
  leveraged?: boolean
  heightClass?: string
}) {
  const [blue] = categorical(mode)
  const t = chartTokens(mode)

  // Split the gap into a "protected" part (effective better for the client than
  // the market) and a "given-up" part, so the shading reads directionally. Only
  // one is non-zero at any spot; both stack on the lower of the two lines.
  const rows = data.map((d) => {
    const base = Math.min(d.market, d.effective)
    const gap = Math.abs(d.market - d.effective)
    const better = d.effective >= d.market // LHS: a higher locked rate is protection
    return { ...d, bandBase: base, gainSize: better ? gap : 0, giveSize: better ? 0 : gap }
  })

  const vals = data.flatMap((d) => [d.market, d.effective])
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const pad = Math.max((hi - lo) * 0.12, 0.002)
  const domain: [number, number] = [Number((lo - pad).toFixed(4)), Number((hi + pad).toFixed(4))]

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: blue }} /> Your effective rate
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded"
            style={{ background: `repeating-linear-gradient(90deg, ${t.axis} 0 4px, transparent 4px 7px)` }}
          />
          Market (unhedged)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: STATUS.warning }} /> Protection rate
        </span>
        {leveraged && <span className="font-medium text-amber-600 dark:text-amber-400">⚡ obligation gears up on a favourable move</span>}
      </div>
      <div className={`${heightClass} w-full`}>
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke={t.grid} />
            <XAxis
              dataKey="spot"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v) => rate(v as number)}
              {...axisProps(mode)}
            />
            {/* allowDataOverflow pins the domain to the two rate lines; the band's
                fill below the lower line is clipped rather than pulling in zero. */}
            <YAxis
              domain={domain}
              allowDataOverflow
              tickFormatter={(v) => rate(v as number)}
              width={54}
              {...axisProps(mode)}
            />
            {/* Shaded gap between the effective rate and the market. */}
            <Area dataKey="bandBase" stackId="band" stroke="none" fill="none" isAnimationActive={false} />
            <Area dataKey="gainSize" stackId="band" stroke="none" fill={STATUS.good} fillOpacity={0.14} isAnimationActive={false} />
            <Area dataKey="giveSize" stackId="band" stroke="none" fill={STATUS.serious} fillOpacity={0.14} isAnimationActive={false} />

            {protection.map((lvl, i) => (
              <ReferenceLine key={`p${i}`} y={lvl} stroke={STATUS.warning} strokeDasharray="5 3" strokeOpacity={0.9} />
            ))}
            {barriers.map((b, i) => (
              <ReferenceLine
                key={`b${i}`}
                x={b.level}
                stroke={b.adverse ? STATUS.critical : STATUS.good}
                strokeDasharray="4 3"
                strokeOpacity={0.6}
              />
            ))}
            <ReferenceLine
              x={spot}
              stroke={t.ink}
              strokeWidth={1.5}
              label={{ value: 'spot', position: 'top', fill: t.inkSoft, fontSize: 10 }}
            />

            <Line type="linear" dataKey="market" stroke={t.axis} strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line type="linear" dataKey="effective" stroke={blue} strokeWidth={2.4} dot={false} isAnimationActive={false} />

            <Tooltip
              cursor={{ stroke: t.axis, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null
                const d = payload[0]?.payload as RatePoint
                const gap = d.effective - d.market
                const pips = Math.round(gap * 10000)
                return (
                  <TooltipCard
                    title={`Market ${rate(d.market)}`}
                    rows={[
                      { label: 'Your rate', value: rate(d.effective), color: blue },
                      { label: 'vs market', value: `${pips >= 0 ? '+' : ''}${pips} pips` },
                    ]}
                    footer={d.leveraged ? 'Obligation geared up here' : undefined}
                  />
                )
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
