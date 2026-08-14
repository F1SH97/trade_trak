import { useEffect } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useStore } from './lib/store'
import { useTheme } from './lib/theme-context'
import { Badge } from './components/ui'
import { Overview } from './pages/Overview'
import { Analysis } from './pages/Analysis'
import { Import } from './pages/Import'
import { fmtDay } from './lib/format'

const NAV = [
  { to: '/overview', label: 'Overview', icon: GridIcon },
  { to: '/analysis', label: 'Analysis', icon: SlidersIcon },
  { to: '/import', label: 'Import data', icon: PasteIcon },
]

/** Scroll back to the top whenever the route (path or query) changes, so
 *  deep links like a strip view land at the page heading, not mid-page. */
function ScrollToTop() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname, search])
  return null
}

export default function App() {
  const { portfolio, isSample } = useStore()
  const { mode, toggle } = useTheme()

  return (
    <div className="min-h-full">
      <ScrollToTop />
      <header className="sticky top-0 z-30 border-b border-line bg-brand-800 text-white">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
          <div className="flex items-center gap-2.5">
            <Logo />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">Trade&nbsp;Trak</div>
              <div className="text-[10px] uppercase tracking-wider text-brand-200">Hedging Summary</div>
            </div>
          </div>

          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/15 text-white' : 'text-brand-100 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <n.icon />
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {portfolio && (
              <div className="hidden text-right md:block">
                <div className="text-xs font-medium text-white">{portfolio.label ?? 'Imported book'}</div>
                <div className="text-[10px] text-brand-200">
                  {portfolio.pair} · imported {fmtDay(new Date(portfolio.importedAt))}
                </div>
              </div>
            )}
            {isSample && <Badge tone="warning">Sample data</Badge>}
            <button
              onClick={toggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-100 hover:bg-white/10 hover:text-white"
              aria-label="Toggle theme"
              title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}
            >
              {mode === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>

        {/* mobile nav */}
        <nav className="flex items-center gap-1 border-t border-white/10 px-2 py-1.5 sm:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium ${
                  isActive ? 'bg-white/15 text-white' : 'text-brand-100'
                }`
              }
            >
              <n.icon />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/import" element={<Import />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-8 pt-2 text-center text-[11px] text-ink-muted">
        Trade Trak · figures are indicative and for portfolio visualisation only — not financial advice or a settlement record.
      </footer>
    </div>
  )
}

/* ------------------------------- icons -------------------------------- */

function Logo() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 17l5-5 4 3 6-7" />
        <path d="M14 5h6v6" />
      </svg>
    </div>
  )
}
function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}
function SlidersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  )
}
function PasteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}
