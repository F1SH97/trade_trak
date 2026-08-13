/**
 * Data-viz palette.
 *
 * Chart hues are kept out of Tailwind/CSS because Recharts needs concrete
 * colour strings in JS.  Values are the validated categorical + status ramps
 * from the house data-viz system (colourblind-safe, checked in both modes).
 * Categorical hues are assigned in a FIXED order and never cycled.
 */

export type Mode = 'light' | 'dark'

// Categorical slots (identity encoding) — fixed order.
const CATEGORICAL: Record<Mode, string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}

// Status palette — fixed, never themed by slot. Always paired with a label/icon.
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const

// Sequential blue ramp (magnitude encoding), light→dark.
export const SEQUENTIAL_BLUE = [
  '#cde2fb',
  '#9ec5f4',
  '#6da7ec',
  '#3987e5',
  '#256abf',
  '#184f95',
  '#104281',
]

export function categorical(mode: Mode): string[] {
  return CATEGORICAL[mode]
}

/** Chart surface / axis / grid / ink tokens, matched to index.css. */
export function chartTokens(mode: Mode) {
  return mode === 'dark'
    ? {
        surface: '#182430',
        grid: '#24333f',
        axis: '#748896',
        ink: '#eef3f7',
        inkSoft: '#a9b8c4',
        tooltipBg: '#101820',
        tooltipBorder: '#2c3d4c',
      }
    : {
        surface: '#ffffff',
        grid: '#eef2f6',
        axis: '#8794a1',
        ink: '#16222c',
        inkSoft: '#52616f',
        tooltipBg: '#ffffff',
        tooltipBorder: '#e3e8ee',
      }
}

/** Read the current theme from the <html> class (set before first paint). */
export function currentMode(): Mode {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark'
  }
  return 'light'
}
