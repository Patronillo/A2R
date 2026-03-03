/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'a2r-blue-dark': '#003366',
        'a2r-blue-light': '#0066cc',
      }
    },
  },
  plugins: [],
}
