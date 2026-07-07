/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          bg:        'rgb(var(--clr-bg)        / <alpha-value>)',
          surface:   'rgb(var(--clr-surface)   / <alpha-value>)',
          surface2:  'rgb(var(--clr-surface2)  / <alpha-value>)',
          border:    'rgb(var(--clr-border)    / <alpha-value>)',
          t1:        'rgb(var(--clr-t1)        / <alpha-value>)',
          t2:        'rgb(var(--clr-t2)        / <alpha-value>)',
          t3:        'rgb(var(--clr-t3)        / <alpha-value>)',
          indigo:    'rgb(var(--clr-indigo)    / <alpha-value>)',
          'indigo-dk':'rgb(var(--clr-indigo-dk)/ <alpha-value>)',
          teal:      'rgb(var(--clr-teal)      / <alpha-value>)',
          amber:     'rgb(var(--clr-amber)     / <alpha-value>)',
          night:     'rgb(var(--clr-night)     / <alpha-value>)',
        },
      },
      boxShadow: {
        card:    'var(--shadow-card)',
        'card-lg':'var(--shadow-card-lg)',
      },
    },
  },
  plugins: [],
}
