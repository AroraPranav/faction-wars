/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Remap "white" to a warm bone color so existing text-white / bg-white/x utilities pick it up
        white: '#EBDFC4',
        bone: '#EBDFC4',
        navy: {
          900: '#0D0F1A',
          800: '#111420',
          700: '#161928',
          600: '#1D2235',
        },
        accent: {
          blue: '#4F6EF5',
          gold: '#F5A623',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
