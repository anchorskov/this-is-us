// File: postcss.config.js
module.exports = {
  plugins: [
    // Use the dedicated Tailwind CSS plugin
    require('tailwindcss')({
      // Your Tailwind config can go here if it's not in a separate file,
      // or Tailwind will automatically load from tailwind.config.js if it exists.
      // Make sure your content paths are correctly defined in tailwind.config.js
      // if you're not putting them here.
    }),
    // Use the dedicated PostCSS Nesting plugin for CSS nesting syntax.
    // This resolves the 'ERR_PACKAGE_PATH_NOT_EXPORTED: Package subpath './nesting'' error.
    require('postcss-nesting'),
    require('autoprefixer'), // Autoprefixer should also be required as a function
    // Add other PostCSS plugins here if you need them later.
  ]
};
