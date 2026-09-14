/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        surface: {
          base: 'var(--wb-surface-base)',
          panel: 'var(--wb-surface-panel)',
          raised: 'var(--wb-surface-raised)',
          sunken: 'var(--wb-surface-sunken)',
          border: 'var(--wb-surface-border)',
          hover: 'var(--wb-surface-hover)',
        },
        content: {
          primary: 'var(--wb-text-primary)',
          secondary: 'var(--wb-text-secondary)',
          muted: 'var(--wb-text-muted)',
          inverse: 'var(--wb-text-inverse)',
        },
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '22px',
      },
      boxShadow: {
        panel: 'var(--wb-shadow-panel)',
        float: 'var(--wb-shadow-float)',
        pop: 'var(--wb-shadow-pop)',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Microsoft YaHei',
          'Source Han Sans SC',
          'sans-serif',
        ],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.06)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-up': 'slide-up 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-down': 'slide-down 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        'scale-in': 'scale-in 140ms cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-soft': 'pulse-soft 2.6s ease-in-out infinite',
        shimmer: 'shimmer 1.8s infinite',
      },
      transitionTimingFunction: {
        swift: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
