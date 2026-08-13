import {
  Area,
  ComposedChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { rate, usdCompact } from '../../lib/format'
import { categorical, chartTokens, STATUS, type Mode } from '../../theme'
import { TooltipCard, axisProps } from './common'

interface PayoffPoint {
  spot: number
  benefitAUD: number
  obligationUSD: number
}

/** Hedge benefit (AUD) across a range of spot rates, with the live spot and
 *  key barrier levels marked. Answers "what does this rate mean for me?". */
export function PayoffChart({
  data,
  spot,
  barriers,
  mode,
}: {
  data: PayoffPoint[]
  spot: number
  barriers: { level: number; adverse: boolean }[]
  mode: Mode
}) {
  const [blue] = categorical(mode)
  const t = chartTokens(mode)

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="benefitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={blue} stopOpacity={0.22} />
              <stop offset="100%" stopColor={blue} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={t.grid} />
          <XAxis
            dataKey="spot"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v) => rate(v as number)}
            {...axisProps(mode)}
          />
          <YAxis tickFormatter={(v) => usdCompact(v as number)} width={54} {...axisProps(mode)} />
          <ReferenceLine y={0} stroke={t.axis} strokeWidth={1} />
          {barriers.map((b, i) => (
            <ReferenceLine
              key={i}
              x={b.level}
              stroke={b.adverse ? STATUS.critical : STATUS.good}
              strokeDasharray="4 3"
              strokeOpacity={0.7}
            />
          ))}
          <ReferenceLine x={spot} stroke={t.ink} strokeWidth={1.5} label={{ value: 'spot', position: 'top', fill: t.inkSoft, fontSize: 10 }} />
          <Tooltip
            cursor={{ stroke: t.axis, strokeDasharray: '3 3' }}
            content={({ active, payload }) =>
              active && payload && payload.length ? (
                <TooltipCard
                  title={`Spot ${rate(payload[0]?.payload.spot)}`}
                  rows={[
                    { label: 'Hedge benefit', value: `${usdCompact(payload[0]?.payload.benefitAUD)} AUD`, color: blue },
                    { label: 'Obligation', value: `${usdCompact(payload[0]?.payload.obligationUSD)} USD` },
                  ]}
                />
              ) : null
            }
          />
          <Area type="monotone" dataKey="benefitAUD" stroke={blue} strokeWidth={2} fill="url(#benefitFill)" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
