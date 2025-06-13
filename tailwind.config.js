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
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Explicitly scan the root layout directory and its subdirectories
    "./layouts/**/*.html",
    "./layouts/**/*.js", // Include JS files within layouts if any contain classes
    
    // Explicitly scan the static JS directory and its subdirectories
    "./static/js/**/*.js",
    
    // Explicitly scan the content directory and its subdirectories for Markdown
    "./content/**/*.md",
    "./content/**/*.html", // Include if you have any HTML content files outside layouts
    
    // Also include tailwind.config.js itself and postcss.config.js
    // (though less common for purge, it can sometimes help with initialization)
    // "./tailwind.config.js",
    // "./postcss.config.js",
  ],

  // Keep Tailwind’s theme untouched for now
  theme: { extend: {} },

  // Add plugins if/when you need them
  plugins: [
    // This will be handled by postcss.config.js
    // require('@tailwindcss/typography'), // Ensure this is installed if uncommented
  ],

  // Optional: whitelist dynamic classes (example)
  safelist: [
    { pattern: /grid-cols-(1|2|3|4|5|6|7|8|9|10|11|12)/ },
    { pattern: /bg-(red|green|blue|yellow)-(100|200|300)/ },
    // Add any other dynamic classes that Tailwind might miss
  ],
};
