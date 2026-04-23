/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          cyan:   '#06b6d4',
          violet: '#8b5cf6',
          indigo: '#6366f1',
          emerald:'#10b981',
        },
      },
      animation: {
        'fade-in':      'fadeIn 0.3s ease-out',
        'slide-up':     'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        'slide-in-right':'slideInRight 0.3s cubic-bezier(0.16,1,0.3,1)',
        'pulse-dot':    'pulseDot 1.4s ease-in-out infinite',
        'orb-1':        'orbFloat1 18s ease-in-out infinite',
        'orb-2':        'orbFloat2 22s ease-in-out infinite',
        'orb-3':        'orbFloat3 15s ease-in-out infinite',
        'shimmer':      'shimmer 2s linear infinite',
        'glow-pulse':   'glowPulse 2s ease-in-out infinite',
        'spin-slow':    'spin 3s linear infinite',
        'border-flow':  'borderFlow 3s linear infinite',
        'text-gradient':'textGradient 4s ease-in-out infinite',
        'float':        'float 6s ease-in-out infinite',
        'scan-line':    'scanLine 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:       { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:      { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: 0, transform: 'translateX(12px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        pulseDot:     { '0%,80%,100%': { opacity: 0.15, transform: 'scale(0.8)' }, '40%': { opacity: 1, transform: 'scale(1)' } },
        orbFloat1:    {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%':     { transform: 'translate(60px,-40px) scale(1.1)' },
          '66%':     { transform: 'translate(-30px,60px) scale(0.95)' },
        },
        orbFloat2:    {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '40%':     { transform: 'translate(-80px,30px) scale(1.15)' },
          '70%':     { transform: 'translate(40px,-60px) scale(0.9)' },
        },
        orbFloat3:    {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '50%':     { transform: 'translate(50px,50px) scale(1.2)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        glowPulse: {
          '0%,100%': { boxShadow: '0 0 8px 0 rgba(99,102,241,0.4)' },
          '50%':     { boxShadow: '0 0 20px 4px rgba(99,102,241,0.7)' },
        },
        borderFlow: {
          '0%':   { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        textGradient: {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%':     { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-8px)' },
        },
        scanLine: {
          '0%':   { transform: 'translateY(-100%)', opacity: 0 },
          '10%':  { opacity: 1 },
          '90%':  { opacity: 1 },
          '100%': { transform: 'translateY(100vh)', opacity: 0 },
        },
      },
      backgroundSize: {
        '300%': '300%',
      },
    },
  },
  plugins: [],
}
