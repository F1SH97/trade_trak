import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useTheme } from '../lib/theme-context'
import {
  computeKpis,
  creditUsage,
  nextExpiry,
  productMakeup,
  timeline,
  upcomingTriggers,
} from '../lib/analytics'
import { fmtDay, num, pct, rate, relativeDays, usd, usdCompact } from '../lib/format'
import { Card, CardHeader, Empty, StatusDot, Badge } from '../components/ui'
import { KpiTile } from '../components/KpiTile'
import { TradeTable } from '../components/TradeTable'
import { ProtectionTimeline } from '../components/charts/ProtectionTimeline'
import { ProductDonut } from '../components/charts/ProductDonut'
import { CreditBar } from '../components/charts/CreditBar'
import { categorical } from '../theme'

export function Overview() {
  const { portfolio, creditLimit, setCreditLimit } = useStore()
  const { mode } = useTheme()
  const [editLimit, setEditLimit] = useState(false)

  const model = useMemo(() => {
    if (!portfolio) return null
    return {
      kpis: computeKpis(portfolio),
      products: productMakeup(portfolio),
      triggers: upcomingTriggers(portfolio, 6),
      next: nextExpiry(portfolio),
      series: timeline(portfolio),
      credit: creditUsage(portfolio, creditLimit ?? undefined),
    }
  }, [portfolio, creditLimit])

  if (!portfolio || !model) {
    return (
      <Empty
        title="No hedge data loaded"
        hint="Import a book by pasting your hedge summary, or load the sample to explore the dashboard."
        action={
          <Link to="/import" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
            Go to Import
          </Link>
        }
      />
    )
  }

  const { kpis, products, triggers, next, series, credit } = model
  const palette = categorical(mode)

  return (
    <div className="animate-fade space-y-5">
      {/* Page heading */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Hedge Summary Overview</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            {portfolio.label ?? 'Imported book'} · {kpis.pair} · {kpis.tradeCount} trades over {kpis.coverageMonths} active months
          </p>
        </div>
        {next && (
          <Card padded={false} className="px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 2v4M16 2v4" />
                </svg>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Next expiry</div>
                <div className="text-sm font-semibold text-ink">
                  {fmtDay(next.expiry)} <span className="font-normal text-ink-muted">· {relativeDays(next.expiry)}</span>
                </div>
                <div className="max-w-[220px] truncate text-[11px] text-ink-muted">{next.product}</div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Total protection" value={usdCompact(kpis.totalProtection)} sub={`${usd(kpis.totalProtection)}`} accent={palette[0]} />
        <KpiTile
          label="Current obligation"
          value={usdCompact(kpis.currentObligation)}
          sub={`${pct(kpis.currentObligation / (kpis.totalProtection || 1), 0)} of protection`}
          accent={palette[2]}
        />
        <KpiTile
          label="Max potential"
          value={usdCompact(kpis.maxObligation)}
          sub={`+${usdCompact(kpis.potentialObligation)} if leveraged`}
          accent={palette[1]}
        />
        <KpiTile label="Avg protection rate" value={rate(kpis.weightedRate)} sub={`${kpis.pair} · notional-weighted`} accent={palette[6]} />
        <KpiTile label="Credit in use" value={usdCompact(kpis.totalCredit)} sub={credit.utilisation != null ? `${pct(credit.utilisation, 0)} of limit` : 'no limit set'} accent={palette[4]} />
        <KpiTile label="Live trades" value={num(kpis.activeTrades)} sub={`${kpis.tradeCount} total`} accent={palette[5]} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Protection & obligation over time"
            subtitle="Cover in place against current and worst-case (leveraged) obligation, by month"
            right={
              <div className="hidden items-center gap-3 text-[11px] text-ink-muted sm:flex">
                <Legend color={palette[0]} label="Protection" />
                <Legend color={palette[2]} label="Current" />
                <Legend color={palette[1]} label="Max potential" dashed />
              </div>
            }
          />
          <ProtectionTimeline data={series} mode={mode} />
        </Card>

        <Card>
          <CardHeader title="Product make-up" subtitle="Share of protection by product" />
          <ProductDonut data={products} mode={mode} />
        </Card>
      </div>

      {/* Second row: credit + triggers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Credit utilisation"
            subtitle="Facility usage across the book"
            right={
              <button
                className="text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300"
                onClick={() => setEditLimit((v) => !v)}
              >
                {creditLimit ? 'Edit limit' : 'Set limit'}
              </button>
            }
          />
          {editLimit && (
            <div className="mb-3 flex items-center gap-2">
              <input
                type="number"
                defaultValue={creditLimit ?? undefined}
                placeholder="Facility limit (USD)"
                className="tnum w-full rounded-lg border border-line bg-surface-sunken px-3 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = Number((e.target as HTMLInputElement).value)
                    setCreditLimit(Number.isFinite(v) && v > 0 ? v : null)
                    setEditLimit(false)
                  }
                }}
              />
              <button
                className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800"
                onClick={(e) => {
                  const input = (e.currentTarget.previousElementSibling as HTMLInputElement)
                  const v = Number(input.value)
                  setCreditLimit(Number.isFinite(v) && v > 0 ? v : null)
                  setEditLimit(false)
                }}
              >
                Save
              </button>
            </div>
          )}
          <CreditBar used={credit.used} limit={credit.limit} segments={products} mode={mode} />
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Next triggers"
            subtitle="Upcoming barrier observations — adverse levels are the ones that matter"
            right={<Link to="/analysis" className="text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300">Open analysis →</Link>}
          />
          {triggers.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">No barrier triggers in the live book.</p>
          ) : (
            <ul className="divide-y divide-line">
              {triggers.map((ev, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ev.adverse ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>
                    {ev.adverse ? <AlertIcon /> : <CheckIcon />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="tnum text-sm font-semibold text-ink">{rate(ev.level)}</span>
                      <StatusDot tone={ev.adverse ? 'critical' : 'good'} label={ev.adverse ? 'Adverse' : 'Upside'} />
                    </div>
                    <div className="truncate text-[11px] text-ink-muted" title={ev.note}>{ev.note}</div>
                  </div>
                  <div className="whitespace-nowrap text-right">
                    <div className="text-xs font-medium text-ink">{fmtDay(ev.date)}</div>
                    <div className="text-[10px] text-ink-muted">{relativeDays(ev.date)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Trade table */}
      <Card>
        <CardHeader title="Hedge ledger" subtitle={`All ${kpis.tradeCount} lines — click a column to sort`} right={<Badge tone="neutral">{kpis.pair}</Badge>} />
        <TradeTable trades={portfolio.trades} />
      </Card>
    </div>
  )
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-0.5 w-4 rounded" style={{ background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` : color }} />
      {label}
    </span>
  )
}
function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
