/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f0f0f',
        foreground: '#ededed',
        card: '#1a1a1a',
        cardHover: '#222222',
        border: '#333333',
        primary: '#f97316',
        primaryHover: '#ea580c',
        muted: '#737373',
        accent: '#fb923c',
      },
    },
  },
  plugins: [],
}