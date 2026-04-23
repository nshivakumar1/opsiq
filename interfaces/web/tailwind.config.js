/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      colors: {
        violet: {
          950: '#1a0533',
        },
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
        'pulse-dot':  'pulseDot 1.4s ease-in-out infinite',
        'orb-drift':  'orbDrift 20s ease-in-out infinite',
        'star-pulse': 'starPulse 3s ease-in-out infinite',
        'shimmer':    'shimmer 2s linear infinite',
        'float':      'float 7s ease-in-out infinite',
        'spin-slow':  'spin 4s linear infinite',
        'badge-glow': 'badgeGlow 2.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: 'translateY(14px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseDot:  { '0%,80%,100%': { opacity: 0.2, transform: 'scale(0.75)' }, '40%': { opacity: 1, transform: 'scale(1)' } },
        orbDrift:  {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%':     { transform: 'translate(-30px, -20px) scale(1.05)' },
          '66%':     { transform: 'translate(20px, 30px) scale(0.97)' },
        },
        starPulse: {
          '0%,100%': { opacity: 0.5 },
          '50%':     { opacity: 1 },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400% center' },
          '100%': { backgroundPosition: '400% center' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-10px)' },
        },
        badgeGlow: {
          '0%,100%': { boxShadow: '0 0 6px rgba(124,58,237,0.4)' },
          '50%':     { boxShadow: '0 0 16px rgba(124,58,237,0.8)' },
        },
      },
    },
  },
  plugins: [],
}
