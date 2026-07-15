import type { Config } from 'tailwindcss'

const config: Config = {
  // Content globs match this repo layout exactly: app/, lib/, components/.
  // There is NO src/ directory in this project.
  content: [
    './app/**/*.{ts,tsx,js,jsx,mdx}',
    './components/**/*.{ts,tsx,js,jsx,mdx}',
    './lib/**/*.{ts,tsx,js,jsx,mdx}',
    './src/**/*.{ts,tsx,js,jsx,mdx}',
    './pages/**/*.{ts,tsx,js,jsx,mdx}',
  ],
  // Landing/pricing pages use dark: variants keyed to system preference.
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-body)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        display: [
          'var(--font-display)',
          'var(--font-body)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}

export default config
