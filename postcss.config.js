// File: postcss.config.js
module.exports = {
  plugins: [
    // Explicitly use the dedicated PostCSS plugin for Tailwind CSS.
    // This directly targets the package that provides the PostCSS integration.
    // Ensure that your 'tailwind.config.js' is still correctly configured and
    // its content paths cover all your Hugo templates and content files.
    require('@tailwindcss/postcss')(), // <--- IMPORTANT: Call it as a function
    // Use the dedicated PostCSS Nesting plugin for CSS nesting syntax.
    // This resolves potential 'ERR_PACKAGE_PATH_NOT_EXPORTED: Package subpath './nesting'' errors.
    require('postcss-nesting'),
    require('autoprefixer'), // Autoprefixer should also be required as a function
    // Add other PostCSS plugins here if you need them later.
  ]
};
