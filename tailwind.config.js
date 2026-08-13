/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens — resolve to CSS variables defined in index.css,
        // so the same class names work in light and dark themes.
        surface: {
          DEFAULT: 'var(--surface-1)',
          raised: 'var(--surface-2)',
          sunken: 'var(--surface-0)',
        },
        line: 'var(--border)',
        ink: {
          DEFAULT: 'var(--text-primary)',
          soft: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        // Brand slate — taken from the source workbook header fill (#334B5F).
        brand: {
          50: '#f2f5f7',
          100: '#dde5ea',
          200: '#bccdd6',
          300: '#93aebc',
          400: '#688b9e',
          500: '#4d7085',
          600: '#3f5c6e',
          700: '#334b5f',
          800: '#2b3e4e',
          900: '#253442',
          950: '#16222c',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
        pop: '0 8px 24px rgba(16, 24, 40, 0.12)',
      },
      borderRadius: {
        xl: '0.875rem',
      },
    },
  },
  plugins: [],
}
