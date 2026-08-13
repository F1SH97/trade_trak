# Trade Trak — Hedging Summary Dashboard

A modern, interactive way for customers to view their FX hedge portfolio, re-imagining
the current Excel macro workbook. For now, data is **copied out of the existing tool and
pasted in**; the architecture is designed so the paste layer can later be swapped for a
direct feed from the back-end systems.

## Three sections

1. **Overview** — a CFO-friendly, at-a-glance summary: headline KPIs (protection,
   obligations, weighted rate, credit, live trades), a protection-vs-obligation timeline,
   product make-up, credit utilisation, the next expiry, the next barrier triggers
   (adverse ones flagged), and a sortable hedge ledger.
2. **Analysis** — an interactive scenario tool. Drag the market (spot rate) and watch every
   hedge respond: which barriers break, how obligations gear up, what rate each hedge
   transacts at, and what it is worth in AUD — with a payoff curve, a barrier map and a
   per-hedge breakdown. Toggle your position (selling / buying USD) and whether the rate
   applies at expiry, during a window, or through the whole trade.
3. **Import data** — paste the whole hedge-summary sheet straight from the workbook. The
   parser finds the two tables by their headers and maps columns by name, so it tolerates
   spacer columns and re-ordering. Data stays in the browser (localStorage) — nothing is
   uploaded.

## How the data maps

The source workbook has two stacked tables which the parser reads:

- **Monthly timeline** (`Month`, `Protection`, `Current/Potential/Max Obligation`,
  `Average Protection Rate`) → the Overview timeline chart.
- **Trade ledger** (`Expiry`, `Product`, `CCY`, strikes, triggers, windows, `Credit`,
  `Ticket`, `Trade Date`) → everything else. Products are classified into families
  (Forward/FEC, Knock-In, Knock-Out, TARF, …) to drive make-up and scenario logic.

## Tech

- Vite + React + TypeScript
- Tailwind CSS (brand slate `#334B5F`, taken from the workbook)
- Recharts + bespoke SVG for the barrier map
- Colourblind-safe categorical/status palette; light & dark themes

## Develop

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build
```

## Roadmap / where to extend

- **Replace the paste layer with a live feed.** `src/lib/parse.ts` returns a `Portfolio`;
  point a back-end adapter at the same shape (`src/lib/types.ts`) and the whole UI works
  unchanged.
- **Add sections.** Navigation is a single list in `src/App.tsx`; pages are self-contained
  under `src/pages/`.
- **Refine the scenario model.** `src/lib/scenario.ts` is a transparent, first-order model
  with its assumptions documented on the Analysis page — the natural place to plug in
  proper product pricing when the back-ends are connected.

> Figures shown are for portfolio visualisation only — not financial advice or a
> settlement record. The bundled sample book is anonymised and illustrative.
