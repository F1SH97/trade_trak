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
  type PortfolioScenario,
  type ScenarioStatus,
  type TradeScenario,
} from '../lib/scenario'
import type { Portfolio, Trade } from '../lib/types'
import type { Mode } from '../theme'
import { fmtDay, fxCompact, rate, usd, usdCompact } from '../lib/format'
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
  participating: { bg: STATUS.good, label: 'Participating' },
  capped: { bg: STATUS.warning, label: 'Capped at rate' },
  obligated: { bg: STATUS.critical, label: 'Obligated at protection' },
  geared: { bg: STATUS.critical, label: 'Leveraged up' },
  'knocked-out': { bg: STATUS.critical, label: 'Knocked out' },
  improved: { bg: STATUS.good, label: 'Improved' },
  inactive: { bg: '#94a3b8', label: 'Inactive' },
}

export function Analysis() {
  const { portfolio } = useStore()
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

  // Split the whole book into its distinct currency pairs. Spot, barriers and the
  // obligation currency are all per-pair, so a book spanning several pairs can't
  // share one axis — we render a section per pair instead.
  const groups = useMemo(() => (portfolio ? groupByPair(liveTrades(portfolio.trades)) : []), [portfolio])
  const multiPair = !stripActive && groups.length > 1

  if (!portfolio || !book) {
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

  if (multiPair) {
    return <MultiPairView portfolio={portfolio} groups={groups} />
  }

  return <SingleBookView book={book} stripActive={stripActive} stripParam={stripParam} />
}

/* ------------------------------------------------------------------ *
 * Single-pair view — one currency pair, one shared spot slider.
 * This is the drill-in from a Hedge Summary pill (a single ticket/strip)
 * and the whole-book view when the book only has one pair. Unchanged.
 * ------------------------------------------------------------------ */
function SingleBookView({
  book,
  stripActive,
  stripParam,
}: {
  book: Portfolio
  stripActive: boolean
  stripParam: string | null
}) {
  const { mode } = useTheme()
  const bounds = useMemo(() => spotBounds(book), [book])
  const implied = useMemo(() => impliedSpot(book), [book])

  const [spot, setSpot] = useState<number>(() => implied)
  const [perspective, setPerspective] = useState<Perspective>('sellUSD')
  const [observation, setObservation] = useState<Observation>('expiry')

  const scenario = useMemo(
    // Show every expiry in a strip (including past ones); otherwise only live trades.
    () => evaluatePortfolio(book, spot, perspective, observation, !stripActive),
    [book, spot, perspective, observation, stripActive],
  )
  const curve = useMemo(
    () => payoffCurve(book, perspective, { ...bounds, steps: 70 }),
    [book, perspective, bounds],
  )

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
                Scenario spot · {book.pair}
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
          label="Net structure value"
          value={`${scenario.totalBenefitAUD >= 0 ? '+' : ''}${fxCompact(scenario.totalBenefitAUD, scenario.foreignCcy)}`}
          sub={`${scenario.foreignCcy} vs a forward at protection`}
          accent={scenario.totalBenefitAUD >= 0 ? STATUS.good : STATUS.critical}
        />
        <KpiTile
          label="Total obligation"
          value={fxCompact(scenario.totalObligationForeign, scenario.foreignCcy)}
          sub={`${scenario.foreignCcy} · ${usdCompact(scenario.totalObligationUSD)} USD`}
          accent={palette[1]}
        />
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

      {/* Payoff */}
      <Card>
        <CardHeader
          title="Portfolio payoff across the market"
          subtitle={`Structure value (${scenario.foreignCcy}) vs a forward at protection — dashed lines mark barriers, solid line the scenario spot`}
        />
        <PayoffChart data={curve} spot={spot} barriers={barrierLines} mode={mode} ccy={scenario.foreignCcy} />
      </Card>

      {/* Barrier map */}
      <Card>
        <CardHeader title="Barrier map" subtitle="Protection rate and every barrier for the selected expiry" />
        <div className="pt-2">
          <BarrierMap scenarios={scenario.rows} spot={spot} mode={mode} />
        </div>
      </Card>

      {/* Per-trade scenario table */}
      <Card>
        <CardHeader
          title="Per-hedge outcome at this spot"
          subtitle={`Evaluated at ${rate(spot)} · ${perspective === 'sellUSD' ? 'selling USD' : 'buying USD'}`}
        />
        <ScenarioTable rows={scenario.rows} ccy={scenario.foreignCcy} />
      </Card>

      <AssumptionsCard ccy={scenario.foreignCcy} />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Multi-pair view — the whole-book default when the book spans several
 * currency pairs. A portfolio roll-up on top, then one collapsible
 * section per pair, each with its own spot slider (denominated in the
 * hedge currency). Expanding a pair reveals its barrier map + hedges.
 * ------------------------------------------------------------------ */
function MultiPairView({ portfolio, groups }: { portfolio: Portfolio; groups: PairGroup[] }) {
  const { mode } = useTheme()

  // One independent spot per pair, seeded at each pair's implied rate. Lifting it
  // here lets the roll-up react as the customer drags any pair's slider.
  const [spots, setSpots] = useState<Record<string, number>>(() =>
    Object.fromEntries(groups.map((g) => [g.pair, impliedSpot(subBook(portfolio, g))])),
  )

  const evaluated = useMemo(
    () =>
      groups.map((g) => {
        const sub = subBook(portfolio, g)
        const spot = spots[g.pair] ?? impliedSpot(sub)
        return { group: g, sub, spot, scenario: evaluatePortfolio(sub, spot, 'sellUSD', 'expiry') }
      }),
    [portfolio, groups, spots],
  )

  const roll = useMemo(() => rollup(evaluated.map((e) => e.scenario)), [evaluated])

  return (
    <div className="animate-fade space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Analysis · Market scenarios</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          Full book — <strong className="font-semibold text-ink">{groups.length} currency pairs</strong> · {roll.liveTrades} live trades. Each pair
          moves on its own spot; barriers and obligations stay in that pair&apos;s world.
        </p>
      </div>

      {/* Portfolio roll-up */}
      <div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiTile
            label="Book obligation"
            value={roll.commonBase ? fxCompact(roll.obligationForeign, roll.commonBase) : usdCompact(roll.obligationUSD)}
            sub={roll.commonBase ? `${groups.length} pairs · ${usdCompact(roll.obligationUSD)} USD` : `${groups.length} pairs`}
            accent={categorical(mode)[0]}
          />
          <KpiTile
            label="Net structure value"
            value={
              roll.commonBase
                ? `${roll.benefitForeign >= 0 ? '+' : ''}${fxCompact(roll.benefitForeign, roll.commonBase)}`
                : `${roll.favourablePairs}/${groups.length}`
            }
            sub={roll.commonBase ? 'vs forwards at protection' : 'pairs net favourable'}
            accent={roll.commonBase ? (roll.benefitForeign >= 0 ? STATUS.good : STATUS.critical) : STATUS.good}
          />
          <KpiTile
            label="Adverse hedges"
            value={String(roll.adverse)}
            sub={`of ${roll.liveTrades} live trades`}
            accent={roll.adverse > 0 ? STATUS.serious : STATUS.good}
          />
          <KpiTile
            label="Exposed notional"
            value={usdCompact(roll.exposedUSD)}
            sub="USD with protection knocked out"
            accent={roll.exposedUSD > 0 ? STATUS.critical : STATUS.good}
          />
        </div>
        <p className="mt-2 px-0.5 text-[11px] text-ink-muted">
          {roll.commonBase
            ? `Totals aggregate only because every pair shares the ${roll.commonBase} base leg. USD figures are always comparable.`
            : 'Pairs span unrelated base currencies, so the book obligation is shown in USD and value is summarised as a count.'}
        </p>
      </div>

      {/* Per-pair sections */}
      <div className="space-y-4">
        {evaluated.map((e) => (
          <PairCard
            key={e.group.pair}
            sub={e.sub}
            scenario={e.scenario}
            spot={e.spot}
            onSpot={(v) => setSpots((s) => ({ ...s, [e.group.pair]: v }))}
            mode={mode}
          />
        ))}
      </div>

      <AssumptionsCard ccy={null} />
    </div>
  )
}

function PairCard({
  sub,
  scenario,
  spot,
  onSpot,
  mode,
}: {
  sub: Portfolio
  scenario: PortfolioScenario
  spot: number
  onSpot: (v: number) => void
  mode: Mode
}) {
  const [open, setOpen] = useState(false)
  const palette = categorical(mode)
  const bounds = useMemo(() => spotBounds(sub), [sub])
  const implied = useMemo(() => impliedSpot(sub), [sub])
  const curve = useMemo(() => payoffCurve(sub, 'sellUSD', { ...bounds, steps: 70 }), [sub, bounds])
  const barrierLines = uniqueBarriers(scenario.rows)
  const ccy = scenario.foreignCcy
  const [base, quote] = splitPair(sub.pair)
  const net = scenario.totalBenefitAUD

  return (
    <Card className="!p-0">
      {/* Header — click to expand */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-t-xl px-4 py-3.5 text-left hover:bg-surface-sunken"
      >
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-ink-muted transition-transform ${open ? 'rotate-90' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
        <span className="text-base font-semibold tracking-tight text-ink">
          {base}
          <span className="font-medium text-ink-muted">/{quote}</span>
        </span>
        <Badge tone="neutral">{scenario.rows.length} live</Badge>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{
            background: `color-mix(in srgb, ${net >= 0 ? STATUS.good : STATUS.critical} 15%, transparent)`,
            color: net >= 0 ? STATUS.good : STATUS.critical,
          }}
        >
          {net >= 0 ? '+' : ''}
          {fxCompact(net, ccy)} net
        </span>
        <span className="ml-auto text-[11px] text-ink-muted">
          {open ? 'Click to collapse' : 'Click to expand · barriers & hedges'}
        </span>
      </button>

      <div className="px-4 pb-4">
        {/* Per-pair tiles (in the hedge currency) */}
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          <MiniStat label="Obligation" value={fxCompact(scenario.totalObligationForeign, ccy)} sub={`${usdCompact(scenario.totalObligationUSD)} USD`} />
          <MiniStat
            label="Structure value"
            value={`${net >= 0 ? '+' : ''}${fxCompact(net, ccy)}`}
            sub="vs forward at protection"
            tone={net >= 0 ? STATUS.good : STATUS.critical}
          />
          <MiniStat label="Adverse" value={String(scenario.adverseCount)} sub={`of ${scenario.rows.length} hedges`} />
          <MiniStat label="Exposed" value={usdCompact(scenario.totalExposedUSD)} sub="protection lost" />
        </div>

        {/* Mini payoff */}
        <p className="mb-1 mt-4 text-[11px] font-medium text-ink-soft">
          Portfolio payoff — structure value ({ccy}) across {sub.pair}
        </p>
        <PayoffChart data={curve} spot={spot} barriers={barrierLines} mode={mode} ccy={ccy} heightClass="h-52" />

        {/* Per-pair spot slider (no position / rate toggles) */}
        <div className="mt-2">
          <div className="flex items-baseline justify-between">
            <span className="tnum text-2xl font-semibold tracking-tight text-ink">{rate(spot)}</span>
            <span className="flex items-center gap-2 text-[11px] text-ink-muted">
              implied {rate(implied)}
              <button className="rounded border border-line px-2 py-0.5 font-medium text-ink-soft hover:bg-surface-sunken" onClick={() => onSpot(implied)}>
                Reset
              </button>
            </span>
          </div>
          <input
            type="range"
            min={bounds.min}
            max={bounds.max}
            step={0.0005}
            value={spot}
            onChange={(e) => onSpot(Number(e.target.value))}
            className="mt-2 w-full"
            style={{ accentColor: palette[0] }}
          />
          <div className="mt-1 flex justify-between text-[10px] text-ink-muted">
            <span>{sub.pair}</span>
            <span className="text-red-500">stronger obligation ◄</span>
            <span className="text-emerald-600 dark:text-emerald-400">► more upside</span>
          </div>
        </div>

        {/* Expanded detail */}
        {open && (
          <div className="mt-4 space-y-4 border-t border-line pt-4">
            <div>
              <h4 className="text-sm font-semibold text-ink">Barrier map</h4>
              <p className="mb-1 text-[11px] text-ink-muted">Protection rate and every barrier on {sub.pair}</p>
              <BarrierMap scenarios={scenario.rows} spot={spot} mode={mode} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-ink">Per-hedge outcome at this spot</h4>
              <p className="mb-1 text-[11px] text-ink-muted">Evaluated at {rate(spot)} · selling USD</p>
              <ScenarioTable rows={scenario.rows} ccy={ccy} />
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function MiniStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-sunken px-3 py-2.5">
      <p className="text-[9.5px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="tnum mt-0.5 text-[17px] font-semibold text-ink" style={tone ? { color: tone } : undefined}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-ink-soft">{sub}</p>}
    </div>
  )
}

function AssumptionsCard({ ccy }: { ccy: string | null }) {
  return (
    <Card className="border-dashed">
      <CardHeader title="Model assumptions" subtitle="How these scenarios are computed" />
      <ul className="list-inside list-disc space-y-1 text-xs text-ink-soft">
        <li>Products follow the Convera Rules of Barriers: on an <strong>LHS</strong> trade a higher spot is favourable (RHS: lower). Triggers are read relative to the protection rate.</li>
        <li><strong>Knock-ins</strong> on the favourable side are bad triggers — if reached, participation is lost and you transact at the protection rate. Inverted knock-ins obligate at the enhanced rate instead.</li>
        <li><strong>Knock-outs</strong> lose cover if breached (shown as exposed); convertible knock-outs are good triggers — the structure becomes a vanilla with full protection and upside.</li>
        <li>Enhanced / leveraged products (knock-outs, TARFs) gear the obligation to the max on a favourable move; TARF target-accrual redemption is not path-simulated.</li>
        <li><strong>Structure value</strong> is measured against a plain forward at the protection rate: transacting at protection is the zero line, so a knock-in improver draws a shark-fin (value falls back to zero when it knocks in) and a collar plateaus at its participation cap.</li>
        <li>
          Foreign-currency figures convert USD at{' '}
          <code className="rounded bg-surface-sunken px-1">{ccy ? `${ccy} = USD ÷ rate` : 'each pair’s currency = USD ÷ rate'}</code>. This is a
          first-order intuition tool, not a settlement or valuation model.
        </li>
      </ul>
    </Card>
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

function ScenarioTable({ rows, ccy }: { rows: TradeScenario[]; ccy: string }) {
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
            <th className="px-3 py-2 text-right font-semibold">Value ({ccy})</th>
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
                  {r.benefitAUD >= 0 ? '+' : ''}{fxCompact(r.benefitAUD, ccy)}
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

/* ---- multi-pair helpers ---- */

interface PairGroup {
  pair: string
  trades: Trade[]
}

/** Live (not-yet-expired) trades, matching the default onlyActive filter. */
function liveTrades(trades: Trade[]): Trade[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return trades.filter((t) => t.expiry >= now)
}

/** Partition trades by their currency pair, largest book first. */
function groupByPair(trades: Trade[]): PairGroup[] {
  const map = new Map<string, Trade[]>()
  for (const t of trades) {
    const key = t.ccy || 'FX'
    const list = map.get(key)
    if (list) list.push(t)
    else map.set(key, [t])
  }
  return [...map.entries()]
    .map(([pair, trades]) => ({ pair, trades }))
    .sort((a, b) => b.trades.length - a.trades.length || a.pair.localeCompare(b.pair))
}

/** A single-pair portfolio the existing scenario engine can consume as-is. */
function subBook(portfolio: Portfolio, group: PairGroup): Portfolio {
  return { ...portfolio, pair: group.pair, trades: group.trades }
}

/** "AUD/USD" → ["AUD", "USD"]; tolerates spaces or a missing separator. */
function splitPair(pair: string): [string, string] {
  const parts = pair.split(/[/\s]+/).filter(Boolean)
  return [parts[0] ?? pair, parts[1] ?? '']
}

/** Aggregate the per-pair scenarios into the book-level roll-up strip. */
function rollup(scenarios: PortfolioScenario[]) {
  const bases = new Set(scenarios.map((s) => s.foreignCcy))
  const commonBase = bases.size === 1 ? [...bases][0] : null
  return {
    commonBase,
    obligationUSD: scenarios.reduce((s, x) => s + x.totalObligationUSD, 0),
    obligationForeign: scenarios.reduce((s, x) => s + x.totalObligationForeign, 0),
    benefitForeign: scenarios.reduce((s, x) => s + x.totalBenefitAUD, 0),
    exposedUSD: scenarios.reduce((s, x) => s + x.totalExposedUSD, 0),
    adverse: scenarios.reduce((s, x) => s + x.adverseCount, 0),
    liveTrades: scenarios.reduce((s, x) => s + x.rows.length, 0),
    favourablePairs: scenarios.filter((x) => x.totalBenefitAUD >= 0).length,
  }
}
