/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
  './App.{js,jsx,ts,tsx}',
  './index.{js,jsx,ts,tsx}',
  './screens/**/*.{js,jsx,ts,tsx}',
  './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        aquadark: '#020617',
        aquaprimary: '#0ea5e9',
        aquaaccent: '#38bdf8',
      },
    },
  },
  plugins: [],
};


