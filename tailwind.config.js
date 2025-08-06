/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'parchment': '#f5f5dc',
        'brown': {
          100: '#f5f5dc',
          200: '#e8e4c9',
          300: '#d4c4a8',
          400: '#c4a484',
          500: '#8b4513',
          600: '#654321',
        }
      },
      fontFamily: {
        'serif': ['Georgia', 'serif'],
      }
    },
  },
  plugins: [],
} 