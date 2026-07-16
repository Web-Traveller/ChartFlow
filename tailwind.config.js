/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'tv-bg-primary': 'var(--tv-bg-primary)',
        'tv-bg-secondary': 'var(--tv-bg-secondary)',
        'tv-bg-tertiary': 'var(--tv-bg-tertiary)',
        'tv-border': 'var(--tv-border)',
        'tv-text-primary': 'var(--tv-text-primary)',
        'tv-text-muted': 'var(--tv-text-muted)',
        'tv-brand': 'var(--tv-brand)',
        'tv-brand-hover': 'var(--tv-brand-hover)',
        'tv-green': 'var(--tv-green)',
        'tv-green-hover': 'var(--tv-green-hover)',
        'tv-red': 'var(--tv-red)',
        'tv-red-hover': 'var(--tv-red-hover)',
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
