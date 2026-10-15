/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef2f8',
          100: '#d9e1ef',
          200: '#b3c3df',
          300: '#849fc9',
          400: '#5477ab',
          500: '#3a5a8c',
          600: '#2c4670',
          700: '#22365a',
          800: '#1a2942',
          900: '#14203a',
          950: '#0d1729',
        },
        leaf: {
          50: '#f3f7ec',
          100: '#e4eed6',
          200: '#c9dcb0',
          300: '#a5c382',
          400: '#7ea657',
          500: '#5c8338',
          600: '#3b5b20',
          700: '#2f4a19',
          800: '#263a16',
          900: '#203014',
        },
        primary: {
          50: '#eff5ff',
          100: '#dbe8fe',
          200: '#bfd7fe',
          300: '#93bbfd',
          400: '#6096fa',
          500: '#3b76f6',
          600: '#2563eb',
          700: '#1d4fd7',
          800: '#1e42ae',
          900: '#1e3b89',
        },
        surface: {
          50: '#f7f9fc',
          100: '#eef2f7',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(16, 32, 58, 0.06), 0 1px 2px rgba(16, 32, 58, 0.04)',
        'card-lg': '0 8px 24px rgba(16, 32, 58, 0.08)',
        'lg': '0 10px 30px rgba(16, 32, 58, 0.12), 0 4px 12px rgba(16, 32, 58, 0.08)',
        '2xl': '0 20px 50px rgba(16, 32, 58, 0.15), 0 8px 20px rgba(16, 32, 58, 0.1)',
        nav: '0 -1px 0 rgba(16, 32, 58, 0.06)',
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.25s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
