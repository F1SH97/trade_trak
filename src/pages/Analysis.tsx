import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useTheme } from '../lib/theme-context'
import { tradesInStrip } from '../lib/analytics'
import {
  evaluatePortfolio,
  impliedSpot,
  payoffCurve,
  spotBounds,
  type Observation,
  type Perspective,
  type ScenarioStatus,
  type TradeScenario,
} from '../lib/scenario'
import { fmtDay, rate, usd, usdCompact } from '../lib/format'
import { Card, CardHeader, Empty, Badge } from '../components/ui'
import { KpiTile } from '../components/KpiTile'
import { PayoffChart } from '../components/charts/PayoffChart'
import { BarrierMap } from '../components/charts/BarrierMap'
import { STATUS, categorical } from '../theme'

const OBSERVATIONS: { key: Observation; label: string; hint: string }[] = [
  { key: 'expiry', label: 'At expiry', hint: 'Barriers assessed only on the expiry date (European style).' },
  { key: 'window', label: 'During a window', hint: 'Barriers can trigger any time inside the observation window.' },
  { key: 'duration', label: 'Through duration', hint: 'Barriers live for the whole life of the trade (continuous).' },
]

const statusTone: Record<ScenarioStatus, { bg: string; label: string }> = {
  committed: { bg: STATUS.warning, label: 'Committed' },
  protected: { bg: STATUS.good, label: 'Protected' },
  geared: { bg: STATUS.critical, label: 'Leveraged up' },
  'knocked-out': { bg: STATUS.critical, label: 'Knocked out' },
  improved: { bg: STATUS.good, label: 'Improved' },
  inactive: { bg: '#94a3b8', label: 'Inactive' },
}

export function Analysis() {
  const { portfolio } = useStore()
  const { mode } = useTheme()
  const [params] = useSearchParams()
  const stripParam = params.get('strip')

  // When arriving from a Hedge Summary pill, narrow the analysis to that strip
  // (all expiries booked under one ticket). Falls back to the whole book.
  const book = useMemo(() => {
    if (!portfolio) return null
    if (!stripParam) return portfolio
    const trades = tradesInStrip(portfolio, stripParam)
    return trades.length ? { ...portfolio, trades } : portfolio
  }, [portfolio, stripParam])
  const stripActive = !!book && book !== portfolio

  const bounds = useMemo(() => (book ? spotBounds(book) : { min: 0.55, max: 0.8 }), [book])
  const implied = useMemo(() => (book ? impliedSpot(book) : 0.65), [book])

  const [spot, setSpot] = useState<number>(() => implied)
  const [perspective, setPerspective] = useState<Perspective>('sellUSD')
  const [observation, setObservation] = useState<Observation>('expiry')

  const scenario = useMemo(
    // Show every expiry in a strip (including past ones); otherwise only live trades.
    () => (book ? evaluatePortfolio(book, spot, perspective, observation, !stripActive) : null),
    [book, spot, perspective, observation, stripActive],
  )
  const curve = useMemo(
    () => (book ? payoffCurve(book, perspective, { ...bounds, steps: 70 }) : []),
    [book, perspective, bounds],
  )

  if (!portfolio || !book || !scenario) {
    return (
      <Empty
        title="No hedge data to analyse"
        hint="Import a book first, then explore what different market rates would mean."
        action={
          <Link to="/import" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
            Go to Import
          </Link>
        }
      />
    )
  }

  const palette = categorical(mode)
  const barrierLines = uniqueBarriers(scenario.rows)
  const move = (implied ? (spot - implied) / implied : 0) * 100

  return (
    <div className="animate-fade space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Analysis · Market scenarios</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          Move {book.pair} and see how every hedge responds — which barriers break, how obligations leverage, and what
          each rate is worth.
        </p>
      </div>

      {stripActive && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs dark:border-brand-500/30 dark:bg-brand-500/10">
          <span className="text-ink-soft">
            Showing one strip — <span className="font-semibold text-ink">{book.trades.length} {book.trades.length === 1 ? 'expiry' : 'expiries'}</span>{' '}
            under ticket <span className="tnum font-medium text-ink">{stripParam}</span>
            <span className="text-ink-muted"> · {book.trades[0]?.product}</span>
          </span>
          <Link to="/analysis" className="whitespace-nowrap font-medium text-brand-600 hover:underline dark:text-brand-300">
            Show full book →
          </Link>
        </div>
      )}

      {/* Controls */}
      <Card>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
          {/* Spot slider */}
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Scenario spot · {portfolio.pair}
              </span>
              <span className="text-[11px] text-ink-muted">
                implied {rate(implied)} · <span className={move >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>{move >= 0 ? '+' : ''}{move.toFixed(1)}%</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="tnum text-3xl font-semibold tracking-tight text-ink">{rate(spot)}</span>
              <div className="flex flex-col gap-1">
                <button className="rounded border border-line px-2 text-xs text-ink-soft hover:bg-surface-sunken" onClick={() => setSpot((s) => Number((s + 0.0025).toFixed(4)))}>+</button>
                <button className="rounded border border-line px-2 text-xs text-ink-soft hover:bg-surface-sunken" onClick={() => setSpot((s) => Number((s - 0.0025).toFixed(4)))}>−</button>
              </div>
              <button className="ml-auto rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:bg-surface-sunken" onClick={() => setSpot(implied)}>
                Reset to implied
              </button>
            </div>
            <input
              type="range"
              min={bounds.min}
              max={bounds.max}
              step={0.0005}
              value={spot}
              onChange={(e) => setSpot(Number(e.target.value))}
              className="mt-3 w-full accent-brand-600"
              style={{ accentColor: palette[0] }}
            />
            <div className="mt-1 flex justify-between text-[10px] text-ink-muted">
              <span>{rate(bounds.min)}</span>
              <span className="text-red-500">stronger obligation ◄</span>
              <span className="text-emerald-600 dark:text-emerald-400">► more upside</span>
              <span>{rate(bounds.max)}</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Your position</span>
              <SegToggle
                value={perspective}
                onChange={(v) => setPerspective(v as Perspective)}
                options={[
                  { key: 'sellUSD', label: 'Selling USD' },
                  { key: 'buyUSD', label: 'Buying USD' },
                ]}
              />
            </div>
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Rate applies</span>
              <SegToggle
                value={observation}
                onChange={(v) => setObservation(v as Observation)}
                options={OBSERVATIONS.map((o) => ({ key: o.key, label: o.label }))}
              />
              <p className="mt-1 text-[11px] text-ink-muted">{OBSERVATIONS.find((o) => o.key === observation)?.hint}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Scenario KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          label="Net hedge benefit"
          value={`${scenario.totalBenefitAUD >= 0 ? '+' : ''}${usdCompact(scenario.totalBenefitAUD)}`}
          sub="AUD vs transacting at this spot"
          accent={scenario.totalBenefitAUD >= 0 ? STATUS.good : STATUS.critical}
        />
        <KpiTile label="Total obligation" value={usdCompact(scenario.totalObligationUSD)} sub="USD at this spot" accent={palette[1]} />
        <KpiTile
          label="Adverse hedges"
          value={String(scenario.adverseCount)}
          sub={`${scenario.rows.length} live trades`}
          accent={scenario.adverseCount > 0 ? STATUS.serious : STATUS.good}
        />
        <KpiTile
          label="Exposed notional"
          value={usdCompact(scenario.totalExposedUSD)}
          sub="USD with protection knocked out"
          accent={scenario.totalExposedUSD > 0 ? STATUS.critical : STATUS.good}
        />
      </div>

      {/* Payoff + barrier map */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Portfolio payoff across the market"
            subtitle="Hedge benefit (AUD) as spot moves — dashed lines mark barriers, solid line the scenario spot"
          />
          <PayoffChart data={curve} spot={spot} barriers={barrierLines} mode={mode} />
        </Card>
        <Card>
          <CardHeader title="Barrier map" subtitle="Where each barrier sits vs the scenario spot" />
          <div className="pt-2">
            <BarrierMap scenarios={scenario.rows} spot={spot} min={bounds.min} max={bounds.max} mode={mode} />
          </div>
        </Card>
      </div>

      {/* Per-trade scenario table */}
      <Card>
        <CardHeader
          title="Per-hedge outcome at this spot"
          subtitle={`Evaluated at ${rate(spot)} · ${perspective === 'sellUSD' ? 'selling USD' : 'buying USD'}`}
        />
        <ScenarioTable rows={scenario.rows} />
      </Card>

      {/* Assumptions */}
      <Card className="border-dashed">
        <CardHeader title="Model assumptions" subtitle="How these scenarios are computed" />
        <ul className="list-inside list-disc space-y-1 text-xs text-ink-soft">
          <li>Forwards / FECs are unconditional and transact at the protection strike.</li>
          <li>Knock-outs lose protection if spot trades through the barrier; the notional is then shown as exposed.</li>
          <li>Leveraged knock-ins leverage the obligation to the max when the lower barrier breaks; the upper barrier is treated as an improver (a positive).</li>
          <li>TARFs leverage below the strike; target-accrual redemption is not path-simulated.</li>
          <li>AUD figures convert USD at <code className="rounded bg-surface-sunken px-1">AUD = USD ÷ rate</code>. This is a first-order intuition tool, not a settlement or valuation model.</li>
        </ul>
      </Card>
    </div>
  )
}

function SegToggle({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { key: string; label: string }[]
}) {
  return (
    <div className="inline-flex w-full rounded-lg border border-line bg-surface-sunken p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            value === o.key ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink-soft'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ScenarioTable({ rows }: { rows: TradeScenario[] }) {
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full min-w-[760px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-soft">
            <th className="px-3 py-2 text-left font-semibold">Expiry</th>
            <th className="px-3 py-2 text-left font-semibold">Product</th>
            <th className="px-3 py-2 text-left font-semibold">Status</th>
            <th className="px-3 py-2 text-right font-semibold">Obligation</th>
            <th className="px-3 py-2 text-right font-semibold">Eff. rate</th>
            <th className="px-3 py-2 text-right font-semibold">Nearest barrier</th>
            <th className="px-3 py-2 text-right font-semibold">Benefit (AUD)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const nearest = r.barriers.slice().sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))[0]
            const tone = statusTone[r.status]
            return (
              <tr key={r.trade.id} className="border-b border-line/60 hover:bg-surface-sunken">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-ink">{fmtDay(r.trade.expiry)}</td>
                <td className="px-3 py-2">
                  <Badge tone="neutral">{r.trade.family}</Badge>
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                    <span className="h-2 w-2 rounded-full" style={{ background: tone.bg }} />
                    {tone.label}
                  </span>
                </td>
                <td className="tnum whitespace-nowrap px-3 py-2 text-right text-ink-soft">{usd(r.obligationUSD)}</td>
                <td className="tnum whitespace-nowrap px-3 py-2 text-right text-ink-soft">{r.effectiveRate ? rate(r.effectiveRate) : '—'}</td>
                <td className="tnum whitespace-nowrap px-3 py-2 text-right">
                  {nearest ? (
                    <span className={nearest.breached ? 'font-semibold text-red-500' : 'text-ink-soft'}>
                      {rate(nearest.level)}
                      <span className="ml-1 text-[10px] text-ink-muted">
                        ({nearest.distance >= 0 ? '+' : ''}{(nearest.distance * 10000).toFixed(0)} pips)
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </td>
                <td className={`tnum whitespace-nowrap px-3 py-2 text-right font-medium ${r.benefitAUD >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                  {r.benefitAUD >= 0 ? '+' : ''}{usdCompact(r.benefitAUD)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function uniqueBarriers(rows: TradeScenario[]): { level: number; adverse: boolean }[] {
  const map = new Map<string, { level: number; adverse: boolean }>()
  for (const r of rows) {
    for (const b of r.barriers) {
      const key = b.level.toFixed(4)
      if (!map.has(key)) map.set(key, { level: b.level, adverse: b.adverse })
    }
  }
  return [...map.values()]
}
