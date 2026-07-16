/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tv: {
          bg: {
            primary: 'var(--tv-bg-primary)',
            secondary: 'var(--tv-bg-secondary)',
            tertiary: 'var(--tv-bg-tertiary)',
          },
          border: 'var(--tv-border)',
          text: {
            primary: 'var(--tv-text-primary)',
            muted: 'var(--tv-text-muted)',
          },
          brand: {
            DEFAULT: 'var(--tv-brand)',
            hover: 'var(--tv-brand-hover)',
          },
          green: {
            DEFAULT: 'var(--tv-green)',
            hover: 'var(--tv-green-hover)',
          },
          red: {
            DEFAULT: 'var(--tv-red)',
            hover: 'var(--tv-red-hover)',
          }
        }
      },
      spacing: {
        'tv-xs': 'var(--spacing-xs)',
        'tv-sm': 'var(--spacing-sm)',
        'tv-md': 'var(--spacing-md)',
        'tv-lg': 'var(--spacing-lg)',
        'tv-xl': 'var(--spacing-xl)',
        'tv-2xl': 'var(--spacing-2xl)',
      },
      borderRadius: {
        'tv-sm': 'var(--radius-sm)',
        'tv-md': 'var(--radius-md)',
        'tv-lg': 'var(--radius-lg)',
        'tv-xl': 'var(--radius-xl)',
      },
      fontFamily: {
        'tv': 'var(--font-stack)',
      }
    },
  },
  plugins: [],
}
