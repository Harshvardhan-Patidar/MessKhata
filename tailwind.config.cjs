/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
      extend: {
        colors: {
          primary: '#16a34a',  // green (good)
          danger: '#dc2626',   // red (alert)
        },
      },
    },
    plugins: [],
  };