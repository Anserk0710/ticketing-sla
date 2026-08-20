/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] },
      boxShadow: { soft: '0 12px 36px rgba(2, 43, 58, 0.08)' },
      colors: {
        /*
         * alice-blue  →  Brand / Accent (derived from #1f7a8c teal)
         * Used for: buttons, active nav, links, badges, focus rings
         */
        'alice-blue': {
          50:  '#f0f9fb',
          100: '#d9eff4',
          200: '#b3dfe9',
          300: '#7dc8d8',
          400: '#44aabf',
          500: '#2a90a6',
          600: '#1f7a8c', // ← Brand primary
          700: '#1a6070',
          800: '#184f5c',
          900: '#17424d',
          950: '#0d2a33',
        },
        /*
         * powder-blue  →  Sidebar / Navigation shell (derived from #022b3a deep teal-navy)
         * Used for: sidebar bg, dark nav elements, footer bg
         */
        'powder-blue': {
          50:  '#f0f7fa',
          100: '#d9edf5',
          200: '#b3daeb',
          300: '#7dbfdb',
          400: '#3f9dc0',
          500: '#2480a3',
          600: '#1d6686',
          700: '#1a526b',
          800: '#194559',
          900: '#173a4c',
          950: '#022b3a', // ← Deep sidebar / footer
        },
        /*
         * lavender-grey  →  Borders, dividers, and muted secondary text
         * 200 = #e1e5f2 borders/dividers
         * 300 = #bfdbf7 light surface
         * 500 = muted body text (WCAG AA on white)
         * 700 = emphasized secondary text
         */
        'lavender-grey': {
          50:  '#f8fafd',
          100: '#f1f4fb',
          200: '#e1e5f2', // ← border / divider
          300: '#bfdbf7', // ← light card surface
          400: '#97b5dc',
          500: '#5a7ea8',  // ← muted text — readable on white
          600: '#3d6288',  // ← secondary text — strong enough
          700: '#2a4d72',  // ← emphasized secondary
          800: '#1d3a5c',
          900: '#122845',
          950: '#0a1a30',
        },
        /*
         * charcoal  →  Text hierarchy (true near-black scale)
         * 950/900/800 = body & heading text — always high contrast on white
         * 700/600     = secondary labels
         * 500 down    = very subtle hints only
         */
        charcoal: {
          50:  '#f0f5f7',   // ← almost white tint
          100: '#dce6ea',
          200: '#b9cdd5',
          300: '#8daebf',
          400: '#608fa9',
          500: '#3d7290',
          600: '#2d5c75',   // ← medium — use for secondary labels
          700: '#1f4559',   // ← dark medium
          800: '#133040',   // ← semi-dark body text
          900: '#072030',   // ← dark body text
          950: '#022b3a',   // ← #022b3a — max contrast, headings
        },
        /*
         * iron-grey  →  Neutral page surfaces (derived from #e1e5f2 / #bfdbf7 / #ffffff)
         * Used for: page background, subtle card bg, hover overlay
         */
        'iron-grey': {
          50:  '#ffffff', // ← Pure white — page bg
          100: '#f5f8fd',
          200: '#e1e5f2', // ← Subtle border / divider
          300: '#bfdbf7', // ← Light card surface
          400: '#97b8e8',
          500: '#6d95cf',
          600: '#5076b5',
          700: '#3d5d96',
          800: '#33507c',
          900: '#2b4367',
          950: '#1a2a45',
        },
      },
    }
  },
  plugins: []
};
