/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        'primary-dark': '#1D4ED8',
        'primary-light': '#3B82F6',
        accent: '#F59E0B',
        'accent-dark': '#D97706',
        background: {
          DEFAULT: '#FFFFFF',
          dark: '#121212',
        },
        surface: {
          DEFAULT: '#F9FAFB',
          dark: '#1E1E1E',
        },
        text: {
          DEFAULT: '#111827',
          secondary: '#6B7280',
          dark: '#F9FAFB',
          'dark-secondary': '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
