/*
 * File: postcss.config.js
 * Description: The final, correct configuration for PostCSS.
 * This version uses the required plugins for a Tailwind CSS v3 setup
 * and correctly configures the path for importing theme files.
 * Dependencies:
 * - postcss-import
 * - tailwindcss
 * - autoprefixer
 */
module.exports = {
  plugins: [
    // The postcss-import plugin must be first.
    // We configure it to look inside the PaperMod theme's asset folder,
    // which fixes the "Failed to find" error from the build process.
    require('postcss-import')({
      path: ['themes/PaperMod/assets/css']
    }),

    // The core Tailwind CSS v3 plugin.
    require('tailwindcss'),

    // Autoprefixer for cross-browser compatibility.
    require('autoprefixer'),
  ]
};
