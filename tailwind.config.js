/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./layouts/**/*.{html,js}",
    "./static/js/**/*.js",
    "./content/**/*.md",
  ],

  // Keep Tailwind’s theme untouched for now
  theme: { extend: {} },

  // Add plugins if/when you need them
  plugins: [
    // require('@tailwindcss/typography'),
  ],

  // Optional: whitelist dynamic classes (example)
  safelist: [
    { pattern: /grid-cols-(1|2|3|4|5|6|7|8|9|10|11|12)/ },
    { pattern: /bg-(red|green|blue|yellow)-(100|200|300)/ },
  ],
};
