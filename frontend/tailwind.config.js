/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary — Teal/Cyan (giữ nguyên brand)
        primary: {
          50: '#E6F7F7',
          100: '#C2EAE9',
          200: '#9DDCDB',
          300: '#70CCC9',
          400: '#4BBCB8',
          500: '#2AACA7',
          600: '#229A96',
          700: '#1A8783',
          800: '#136E6B',
          900: '#0C5552',
          950: '#073937',
        },
        // Secondary — Coral/Orange
        secondary: {
          50: '#FFF0ED',
          100: '#FFD9D1',
          200: '#FFC1B5',
          300: '#FFA898',
          400: '#FF8F7B',
          500: '#FF755E',
          600: '#E56954',
          700: '#CC5C4A',
          800: '#B24F40',
          900: '#994236',
          950: '#7A3129',
        },
        // Neutral — chuẩn 2025 dark mode
        neutral: {
          /* Truly neutral — không zinc-blue tint, R=G=B cho mọi shade */
          50:  '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          850: '#1F1F1F',
          900: '#1A1A1A',
          950: '#0F0F0F',
        },
        // 2025 glass/liquid tokens
        glass: {
          white: 'rgba(255,255,255,0.12)',
          'white-hover': 'rgba(255,255,255,0.18)',
          dark: 'rgba(0,0,0,0.3)',
          'dark-hover': 'rgba(0,0,0,0.4)',
          border: 'rgba(255,255,255,0.2)',
          'border-dark': 'rgba(255,255,255,0.08)',
        },
        // Semantic
        success: {
          50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 300: '#6EE7B7',
          400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857',
          800: '#065F46', 900: '#064E3B',
        },
        warning: {
          50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D',
          400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 700: '#B45309',
          800: '#92400E', 900: '#78350F',
        },
        error: {
          50: '#FEF2F2', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5',
          400: '#F87171', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C',
          800: '#991B1B', 900: '#7F1D1D',
        },
        info: {
          50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD',
          400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8',
          800: '#1E40AF', 900: '#1E3A8A',
        },
      },
      fontFamily: {
        heading: ['Montserrat', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
      },
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '3.75rem',
        '7xl': '4.5rem',
        '8xl': '6rem',
        '9xl': '8rem',
        '10xl': '10rem',
      },
      spacing: {
        px: '1px', 0: '0', 0.5: '0.125rem', 1: '0.25rem', 1.5: '0.375rem',
        2: '0.5rem', 2.5: '0.625rem', 3: '0.75rem', 3.5: '0.875rem', 4: '1rem',
        5: '1.25rem', 6: '1.5rem', 7: '1.75rem', 8: '2rem', 9: '2.25rem',
        10: '2.5rem', 11: '2.75rem', 12: '3rem', 14: '3.5rem', 16: '4rem',
        20: '5rem', 24: '6rem', 28: '7rem', 32: '8rem', 36: '9rem',
        40: '10rem', 44: '11rem', 48: '12rem', 52: '13rem', 56: '14rem',
        60: '15rem', 64: '16rem', 72: '18rem', 80: '20rem', 96: '24rem',
      },
      borderRadius: {
        none: '0', sm: '0.125rem', DEFAULT: '0.25rem', md: '0.375rem',
        lg: '0.5rem', xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem',
        '4xl': '2rem', '5xl': '2.5rem', full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
        md: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
        lg: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
        xl: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
        '2xl': '0 25px 50px -12px rgba(0,0,0,0.25)',
        inner: 'inset 0 2px 4px 0 rgba(0,0,0,0.06)',
        // Liquid glass shadows
        glass: '0 8px 32px 0 rgba(31,38,135,0.15), inset 0 0 20px -5px rgba(255,255,255,0.1)',
        'glass-dark': '0 8px 32px 0 rgba(0,0,0,0.4), inset 0 0 20px -5px rgba(255,255,255,0.06)',
        'glass-hover': '0 16px 48px 0 rgba(31,38,135,0.25), inset 0 0 30px -5px rgba(255,255,255,0.15)',
        'glow-primary': '0 0 40px -10px rgba(42,172,167,0.6)',
        'glow-secondary': '0 0 40px -10px rgba(255,117,94,0.5)',
      },
      backdropBlur: {
        xs: '2px', sm: '4px', DEFAULT: '8px', md: '12px',
        lg: '16px', xl: '24px', '2xl': '40px', '3xl': '64px',
      },
      backgroundImage: {
        // Gradient meshes 2025
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-primary': 'radial-gradient(ellipse at 20% 50%, rgba(42,172,167,0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(255,117,94,0.1) 0%, transparent 50%)',
        'mesh-dark': 'radial-gradient(ellipse at 20% 50%, rgba(42,172,167,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(255,117,94,0.06) 0%, transparent 50%)',
        'hero-light': 'linear-gradient(135deg, #f0fdfd 0%, #f8fafc 40%, #fff7f5 100%)',
        'hero-dark': 'linear-gradient(135deg, #09090b 0%, #0f0f12 40%, #0d0d10 100%)',
      },
      animation: {
        // Legacy
        fadeIn: 'fadeIn 0.3s ease-out',
        fadeOut: 'fadeOut 0.2s ease-in',
        slideInBottom: 'slideInBottom 0.3s ease-out',
        slideInRight: 'slideInRight 0.3s ease-out',
        scaleIn: 'scaleIn 0.3s ease-out',
        // 2025 animations
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'float-delay': 'float 6s ease-in-out infinite 2s',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'gradient-x': 'gradientX 4s ease infinite',
        'gradient-y': 'gradientY 4s ease infinite',
        'orb-1': 'orb1 8s ease-in-out infinite',
        'orb-2': 'orb2 10s ease-in-out infinite',
        'orb-3': 'orb3 12s ease-in-out infinite',
        'theme-switch': 'themeSwitch 0.4s ease',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.16,1,0.3,1)',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.16,1,0.3,1)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeOut: { '0%': { opacity: '1' }, '100%': { opacity: '0' } },
        slideInBottom: { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideInRight: { '0%': { transform: 'translateX(20px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        scaleIn: { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%': { transform: 'translateY(-12px) rotate(1deg)' },
          '66%': { transform: 'translateY(-6px) rotate(-1deg)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px -5px rgba(42,172,167,0.3)' },
          '50%': { boxShadow: '0 0 40px -5px rgba(42,172,167,0.6)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        gradientY: {
          '0%, 100%': { backgroundPosition: '50% 0%' },
          '50%': { backgroundPosition: '50% 100%' },
        },
        orb1: {
          '0%, 100%': { transform: 'translate(0%, 0%) scale(1)' },
          '50%': { transform: 'translate(10%, 5%) scale(1.1)' },
        },
        orb2: {
          '0%, 100%': { transform: 'translate(0%, 0%) scale(1)' },
          '50%': { transform: 'translate(-8%, 10%) scale(0.95)' },
        },
        orb3: {
          '0%, 100%': { transform: 'translate(0%, 0%) scale(1)' },
          '50%': { transform: 'translate(5%, -10%) scale(1.05)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        themeSwitch: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      transitionDuration: {
        DEFAULT: '200ms', 75: '75ms', 100: '100ms', 150: '150ms',
        200: '200ms', 300: '300ms', 400: '400ms', 500: '500ms',
        700: '700ms', 1000: '1000ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4,0,0.2,1)',
        spring: 'cubic-bezier(0.16,1,0.3,1)',
        bounce: 'cubic-bezier(0.34,1.56,0.64,1)',
        smooth: 'cubic-bezier(0.4,0,0,1)',
      },
      screens: {
        xs: '475px', sm: '640px', md: '768px',
        lg: '1024px', xl: '1280px', '2xl': '1536px',
      },
      zIndex: {
        0: '0', 10: '10', 20: '20', 30: '30', 40: '40', 50: '50',
        60: '60', 70: '70', 80: '80', 90: '90', 100: '100', auto: 'auto',
      },
      lineHeight: {
        3: '.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem', 7: '1.75rem',
        8: '2rem', 9: '2.25rem', 10: '2.5rem',
        none: '1', tight: '1.15', snug: '1.3', normal: '1.5',
        relaxed: '1.625', loose: '2',
      },
    },
  },
  plugins: [],
  safelist: [
    // Grid cols 1-6 — cần cho dynamic Grid component
    ...[1,2,3,4,5,6].flatMap(n => [
      `grid-cols-${n}`,
      `sm:grid-cols-${n}`,
      `md:grid-cols-${n}`,
      `lg:grid-cols-${n}`,
      `xl:grid-cols-${n}`,
    ]),
  ],
};
