import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { parsePaste } from '../lib/parse'
import { computeKpis } from '../lib/analytics'
import { SAMPLE_PASTE } from '../data/samplePaste'
import { fmtDay, num, rate, usdCompact } from '../lib/format'
import { Card, CardHeader, Badge } from '../components/ui'

export function Import() {
  const { portfolio, isSample, setPortfolio, clear, loadSample } = useStore()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [label, setLabel] = useState('')

  const result = useMemo(() => (text.trim() ? parsePaste(text, label.trim() || undefined) : null), [text, label])
  const previewKpis = useMemo(() => (result?.portfolio ? computeKpis(result.portfolio) : null), [result])

  const canImport = !!result?.portfolio && result.errors.length === 0

  function doImport() {
    if (result?.portfolio) {
      setPortfolio(result.portfolio, false)
      navigate('/overview')
    }
  }

  return (
    <div className="animate-fade space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Import data</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          Copy the hedge summary from your workbook and paste it below — the whole sheet is fine. It stays in your
          browser; nothing is uploaded.
        </p>
      </div>

      {/* Current book */}
      <Card>
        <CardHeader
          title="Loaded book"
          subtitle="What the dashboard is currently showing"
          right={
            <div className="flex items-center gap-2">
              {portfolio && (
                <button
                  onClick={() => clear()}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface-sunken"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => loadSample()}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface-sunken"
              >
                Load sample
              </button>
            </div>
          }
        />
        {portfolio ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Field label="Label" value={portfolio.label ?? '—'} />
            <Field label="Pair" value={portfolio.pair} />
            <Field label="Trades" value={num(portfolio.trades.length)} />
            <Field label="Months" value={num(portfolio.monthly.length)} />
            <Field label="Imported" value={fmtDay(new Date(portfolio.importedAt))} />
            {isSample && <Badge tone="warning">Sample data</Badge>}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">No book loaded.</p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Paste area */}
        <Card className="lg:col-span-2">
          <CardHeader title="Paste hedge summary" subtitle="Select the sheet in your tool, copy, then paste here" />
          <div className="mb-3">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label this book (optional) — e.g. client name"
              className="w-full rounded-lg border border-line bg-surface-sunken px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={'Paste here…\n\nTip: in the workbook, select the summary (or press Ctrl+A on the sheet), copy, then paste into this box.'}
            className="tnum h-72 w-full resize-y rounded-lg border border-line bg-surface-sunken px-3 py-2 font-mono text-xs text-ink outline-none focus:border-brand-400"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              disabled={!canImport}
              onClick={doImport}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Use this data →
            </button>
            <button
              onClick={() => setText(SAMPLE_PASTE)}
              className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-sunken"
            >
              Fill with sample paste
            </button>
            {text && (
              <button onClick={() => setText('')} className="px-2 py-2 text-sm text-ink-muted hover:text-ink">
                Clear box
              </button>
            )}
          </div>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader title="Preview" subtitle="Parsed before you commit" />
          {!result ? (
            <p className="py-8 text-center text-sm text-ink-muted">Paste some data to see a preview.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold ${result.stats.tradeRows ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-surface-sunken text-ink-muted'}`}>
                  {result.stats.tradeRows} trades
                </span>
                <span className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold ${result.stats.monthlyRows ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'bg-surface-sunken text-ink-muted'}`}>
                  {result.stats.monthlyRows} months
                </span>
              </div>

              {result.errors.map((e, i) => (
                <Msg key={i} tone="critical" text={e} />
              ))}
              {result.warnings.map((w, i) => (
                <Msg key={i} tone="warning" text={w} />
              ))}

              {previewKpis && (
                <dl className="grid grid-cols-2 gap-2 pt-1">
                  <Stat label="Protection" value={usdCompact(previewKpis.totalProtection)} />
                  <Stat label="Max potential" value={usdCompact(previewKpis.maxObligation)} />
                  <Stat label="Credit" value={usdCompact(previewKpis.totalCredit)} />
                  <Stat label="Avg rate" value={rate(previewKpis.weightedRate)} />
                </dl>
              )}
              {canImport && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  Looks good — press “Use this data”.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* How-to */}
      <Card>
        <CardHeader title="How to copy from your tool" subtitle="The parser matches columns by name, so extra columns are fine" />
        <ol className="grid list-inside list-decimal gap-2 text-sm text-ink-soft sm:grid-cols-3">
          <li>Open the hedge summary sheet in the workbook.</li>
          <li>Select the summary area (or press <kbd className="rounded border border-line bg-surface-sunken px-1 text-xs">Ctrl</kbd>+<kbd className="rounded border border-line bg-surface-sunken px-1 text-xs">A</kbd>) and copy.</li>
          <li>Click in the paste box above and paste (<kbd className="rounded border border-line bg-surface-sunken px-1 text-xs">Ctrl</kbd>+<kbd className="rounded border border-line bg-surface-sunken px-1 text-xs">V</kbd>).</li>
        </ol>
        <p className="mt-3 text-xs text-ink-muted">
          The parser looks for two tables: the monthly timeline (headed <em>Month</em>) and the trade ledger (headed{' '}
          <em>Expiry / Product</em>). It reads the standard columns — protection, obligations, strikes, triggers, windows,
          credit, ticket and trade date — and tolerates spacer columns and re-ordering.
        </p>
      </Card>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="font-medium text-ink">{value}</div>
    </div>
  )
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-sunken px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="tnum text-sm font-semibold text-ink">{value}</div>
    </div>
  )
}
function Msg({ tone, text }: { tone: 'critical' | 'warning'; text: string }) {
  const cls =
    tone === 'critical'
      ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
      : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
  return <p className={`rounded-lg px-3 py-2 text-xs ${cls}`}>{text}</p>
}
