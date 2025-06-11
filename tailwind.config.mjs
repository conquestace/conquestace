/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: 'var(--color-midnight)',
        mathblue: 'var(--color-mathblue)',
        sky: 'var(--color-sky)',
        slatecard: 'var(--color-slatecard)',
        lightblue: 'var(--color-lightblue)',
        hoverblue: 'var(--color-hoverblue)',
        slategray: 'var(--color-slategray)',
        softgray: 'var(--color-softgray)',
      }
    }
  }
};

