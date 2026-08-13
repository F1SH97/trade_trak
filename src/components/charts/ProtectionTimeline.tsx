import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyPoint } from '../../lib/types'
import { fmtMonth, usd, usdCompact } from '../../lib/format'
import { categorical, chartTokens, type Mode } from '../../theme'
import { TooltipCard, axisProps } from './common'

/** Protection cover vs. current / worst-case obligation across the horizon. */
export function ProtectionTimeline({ data, mode }: { data: MonthlyPoint[]; mode: Mode }) {
  const [blue, orange, aqua] = categorical(mode)
  const t = chartTokens(mode)
  const rows = data.map((m) => ({
    label: fmtMonth(m.month),
    protection: m.protection,
    current: m.currentObligation,
    max: m.maxObligation,
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="protFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={blue} stopOpacity={0.28} />
              <stop offset="100%" stopColor={blue} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={t.grid} />
          <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={24} {...axisProps(mode)} />
          <YAxis tickFormatter={(v) => usdCompact(v as number)} width={52} {...axisProps(mode)} />
          <Tooltip
            cursor={{ stroke: t.axis, strokeDasharray: '3 3' }}
            content={({ active, payload, label }) =>
              active && payload && payload.length ? (
                <TooltipCard
                  title={String(label)}
                  rows={[
                    { label: 'Protection', value: usd(payload[0]?.payload.protection), color: blue },
                    { label: 'Current obligation', value: usd(payload[0]?.payload.current), color: aqua },
                    { label: 'Max potential', value: usd(payload[0]?.payload.max), color: orange },
                  ]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="protection"
            stroke={blue}
            strokeWidth={2}
            fill="url(#protFill)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Line type="monotone" dataKey="max" stroke={orange} strokeWidth={2} dot={false} strokeDasharray="5 3" />
          <Line type="monotone" dataKey="current" stroke={aqua} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
