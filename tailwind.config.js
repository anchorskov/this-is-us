/** @type {import('tailwindcss').Config} */
module.exports = {
  // Use 'important: true' for debugging. This ensures Tailwind's styles
  // always override other styles. Remove after debugging.
  // important: true, 

  // For debugging ONLY: Temporarily disable CSS purging to see if all Tailwind classes
  // are generated. If they are, the 'content' array or scanning is the issue.
  // If they are still missing, the tailwind.config.js itself might not be loading.
  // REMOVE THIS FOR PRODUCTION.
  // corePlugins: {
  //   preflight: true, // Enable Tailwind's base styles
  // },
  // future: {
  //   hoverOnlyWhenSupported: true,
  // },
  
  // To force Tailwind to include ALL utility classes for debugging:
  // This essentially disables tree-shaking/purging.
  // REMOVE THIS FOR PRODUCTION!
  purge: false, // For older Tailwind versions (v2/v3)
  content: [
    // Keep content paths as is; this is what we're ultimately testing
    "./layouts/**/*.html",
    "./layouts/**/*.js", 
    "./static/js/**/*.js",
    "./content/**/*.md",
    "./content/**/*.html",
    "./assets/css/tailwind.css", 
  ],

  // Keep Tailwind’s theme untouched for now
  theme: { extend: {} },

  // Add plugins if/when you need them
  plugins: [
    // This will be handled by postcss.config.js
    // require('@tailwindcss/typography'), 
  ],

  // Safelist any classes that are dynamically generated and might not be picked up by scanning.
  safelist: [
    { pattern: /grid-cols-(1|2|3|4|5|6|7|8|9|10|11|12)/ },
    { pattern: /bg-(red|green|blue|yellow)-(100|200|300)/ },
    'DEBUG-CHECK-CLASS-BG-RED-500', 
    // Add any other dynamic classes that Tailwind might miss
  ],
};
