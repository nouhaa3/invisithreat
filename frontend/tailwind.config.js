/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#FF6B2B',
          'orange-light': '#FF8C5A',
          'orange-deep': '#E84D0E',
          'orange-glow': '#FF4500',
          dark: '#070606',
          surface: '#0f0f0f',
          panel: '#141414',
          card: '#171717',
          input: '#151515',
          border: '#2c2c2c',
          'border-light': '#3a3a3a',
        },
        ink: {
          primary: '#F5F2EE',
          muted: '#B5B0AA',
          subtle: '#8B8782',
        },
        surface: {
          base: '#0b0b0b',
          sunken: '#0f0f0f',
          raised: '#171717',
          glass: 'rgba(255,255,255,0.04)',
        },
        status: {
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#60a5fa',
        },
        glow: {
          amber: 'rgba(255,107,43,0.25)',
          soft: 'rgba(255,140,90,0.2)',
        },
        premium: {
          950: '#080808',
          900: '#0d0d0d',
          850: '#121212',
          800: '#171717',
          700: '#212121',
          ring: 'rgba(255,107,43,0.35)',
          glass: 'rgba(255,255,255,0.035)',
        },
      },
      fontFamily: {
        sans: ['Sora', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        heading: ['Sora', 'Plus Jakarta Sans', 'sans-serif'],
        body: ['Sora', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '1.25rem',
        panel: '1.5rem',
        pill: '999px',
        xl2: '1rem',
        xl3: '1.5rem',
      },
      animation: {
        'float-slow': 'floatSlow 8s ease-in-out infinite',
        'float-med': 'floatMed 6s ease-in-out infinite',
        'float-fast': 'floatFast 4s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'shimmer': 'shimmer 2.5s linear infinite',
        'glow-soft': 'glowSoft 4s ease-in-out infinite',
      },
      keyframes: {
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px) scale(1)' },
          '50%': { transform: 'translateY(-30px) scale(1.05)' },
        },
        floatMed: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '33%': { transform: 'translateY(-20px) translateX(10px)' },
          '66%': { transform: 'translateY(10px) translateX(-10px)' },
        },
        floatFast: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-15px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glowSoft: {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.8' },
        },
      },
      backgroundImage: {
        'orange-gradient': 'linear-gradient(135deg, #FF6B2B 0%, #E84D0E 50%, #C13A00 100%)',
        'orange-glow': 'radial-gradient(ellipse at center, rgba(255,107,43,0.3) 0%, transparent 70%)',
        'surface-radial': 'radial-gradient(circle at top, rgba(255,107,43,0.12), transparent 45%)',
      },
      boxShadow: {
        'orange': '0 0 30px rgba(255, 107, 43, 0.3)',
        'orange-sm': '0 0 15px rgba(255, 107, 43, 0.2)',
        'orange-lg': '0 0 60px rgba(255, 107, 43, 0.4)',
        'inner-dark': 'inset 0 1px 0 rgba(255,255,255,0.05)',
        'elevated': '0 20px 60px rgba(0,0,0,0.55)',
        'lifted': '0 14px 32px rgba(0,0,0,0.45)',
        'glow-soft': '0 0 45px rgba(255,107,43,0.25)',
        'outline-soft': '0 0 0 1px rgba(255,255,255,0.08)',
        'premium-card': '0 18px 46px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.05)',
        'premium-panel': '0 28px 70px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        snappy: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
