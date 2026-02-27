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
          dark: '#0a0a0a',
          surface: '#111111',
          card: '#161616',
          input: '#1c1c1c',
          border: '#2a2a2a',
          'border-light': '#383838',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float-slow': 'floatSlow 8s ease-in-out infinite',
        'float-med': 'floatMed 6s ease-in-out infinite',
        'float-fast': 'floatFast 4s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'shimmer': 'shimmer 2.5s linear infinite',
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
      },
      backgroundImage: {
        'orange-gradient': 'linear-gradient(135deg, #FF6B2B 0%, #E84D0E 50%, #C13A00 100%)',
        'orange-glow': 'radial-gradient(ellipse at center, rgba(255,107,43,0.3) 0%, transparent 70%)',
      },
      boxShadow: {
        'orange': '0 0 30px rgba(255, 107, 43, 0.3)',
        'orange-sm': '0 0 15px rgba(255, 107, 43, 0.2)',
        'orange-lg': '0 0 60px rgba(255, 107, 43, 0.4)',
        'inner-dark': 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }
    },
  },
  plugins: [],
}
