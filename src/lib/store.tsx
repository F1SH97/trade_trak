/**
 * Portfolio store — holds the current book, persists it to localStorage, and
 * seeds the sample paste on first load so the dashboard is never empty.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { parsePaste } from './parse'
import { SAMPLE_PASTE } from '../data/samplePaste'
import type { Portfolio } from './types'

const STORAGE_KEY = 'tt-portfolio-v1'
const CREDIT_LIMIT_KEY = 'tt-credit-limit-v1'

interface StoreValue {
  portfolio: Portfolio | null
  /** True while the currently loaded book is the built-in sample. */
  isSample: boolean
  creditLimit: number | null
  setPortfolio: (p: Portfolio, isSample?: boolean) => void
  clear: () => void
  loadSample: () => void
  setCreditLimit: (n: number | null) => void
}

const Ctx = createContext<StoreValue | null>(null)

function reviveDates(p: Portfolio): Portfolio {
  const d = (v: unknown) => (v ? new Date(v as string) : null)
  return {
    ...p,
    monthly: p.monthly.map((m) => ({ ...m, month: new Date(m.month) })),
    trades: p.trades.map((t) => ({
      ...t,
      expiry: new Date(t.expiry),
      windowStart: d(t.windowStart),
      windowEnd: d(t.windowEnd),
      window2Start: d(t.window2Start),
      window2End: d(t.window2End),
      tradeDate: d(t.tradeDate),
    })),
  }
}

function loadInitial(): { portfolio: Portfolio | null; isSample: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { portfolio: Portfolio; isSample: boolean }
      return { portfolio: reviveDates(parsed.portfolio), isSample: parsed.isSample }
    }
  } catch {
    /* fall through to sample */
  }
  const res = parsePaste(SAMPLE_PASTE, 'Sample book — Acme Pty Ltd')
  return { portfolio: res.portfolio, isSample: true }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => loadInitial())
  const [creditLimit, setCreditLimitState] = useState<number | null>(() => {
    const raw = localStorage.getItem(CREDIT_LIMIT_KEY)
    return raw != null ? Number(raw) : null
  })

  useEffect(() => {
    try {
      if (state.portfolio) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ portfolio: state.portfolio, isSample: state.isSample }))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      /* storage may be unavailable (private mode) — the app still works in-memory */
    }
  }, [state])

  const setPortfolio = useCallback((p: Portfolio, isSample = false) => {
    setState({ portfolio: p, isSample })
  }, [])

  const clear = useCallback(() => setState({ portfolio: null, isSample: false }), [])

  const loadSample = useCallback(() => {
    const res = parsePaste(SAMPLE_PASTE, 'Sample book — Acme Pty Ltd')
    if (res.portfolio) setState({ portfolio: res.portfolio, isSample: true })
  }, [])

  const setCreditLimit = useCallback((n: number | null) => {
    setCreditLimitState(n)
    try {
      if (n == null) localStorage.removeItem(CREDIT_LIMIT_KEY)
      else localStorage.setItem(CREDIT_LIMIT_KEY, String(n))
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      portfolio: state.portfolio,
      isSample: state.isSample,
      creditLimit,
      setPortfolio,
      clear,
      loadSample,
      setCreditLimit,
    }),
    [state, creditLimit, setPortfolio, clear, loadSample, setCreditLimit],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): StoreValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore must be used within StoreProvider')
  return v
}
