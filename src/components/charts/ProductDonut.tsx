import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { ProductSlice } from '../../lib/analytics'
import { pct, rate, usd, usdCompact } from '../../lib/format'
import { CATEGORY_LABEL } from '../../lib/products'
import { categoryColor, type Mode } from '../../theme'
import { TooltipCard } from './common'

/** Product make-up donut: share of protection by product category. */
export function ProductDonut({ data, mode }: { data: ProductSlice[]; mode: Mode }) {
  const total = data.reduce((s, d) => s + d.protection, 0)

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="protection"
              nameKey="category"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={2}
              stroke="var(--surface-1)"
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell key={d.category} fill={categoryColor(d.category, mode)} />
              ))}
            </Pie>
            <Tooltip
              // Lift the tooltip above the centre "Protected" overlay below.
              wrapperStyle={{ zIndex: 30, outline: 'none' }}
              content={({ active, payload }) =>
                active && payload && payload.length ? (
                  <TooltipCard
                    title={CATEGORY_LABEL[payload[0]?.payload.category as ProductSlice['category']]}
                    rows={[
                      { label: 'Amount', value: usd(payload[0]?.payload.protection) },
                      { label: 'Weighted average rate', value: rate(payload[0]?.payload.weightedRate) },
                      { label: '# of trades', value: String(payload[0]?.payload.count) },
                    ]}
                  />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Protected</span>
          <span className="tnum text-lg font-semibold text-ink">{usdCompact(total)}</span>
        </div>
      </div>
      <ul className="w-full space-y-1.5">
        {data.map((d) => (
          <li key={d.category} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 text-ink-soft">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: categoryColor(d.category, mode) }}
              />
              {CATEGORY_LABEL[d.category]}
              <span className="text-ink-muted">· {d.count}</span>
            </span>
            <span className="tnum font-medium text-ink">{pct(d.protection / total, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
