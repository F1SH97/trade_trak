/** Light/dark theme context. Toggling flips the `dark` class on <html> and
 *  bumps a counter charts subscribe to, so SVG colours re-resolve on switch. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Mode } from '../theme'

interface ThemeValue {
  mode: Mode
  toggle: () => void
}

const Ctx = createContext<ThemeValue | null>(null)

function initialMode(): Mode {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) return 'dark'
  return 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(initialMode)

  useEffect(() => {
    const root = document.documentElement
    if (mode === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    try {
      localStorage.setItem('tt-theme', mode)
    } catch {
      /* ignore */
    }
  }, [mode])

  const toggle = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), [])
  const value = useMemo(() => ({ mode, toggle }), [mode, toggle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme(): ThemeValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme must be used within ThemeProvider')
  return v
}
