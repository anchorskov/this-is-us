// File: postcss.config.js
module.exports = {
  plugins: [
    // Explicitly require the PostCSS plugin for Tailwind CSS.
    // Plugins are typically provided as an array of functions or objects.
    require('tailwindcss/nesting'), // This is often needed with Tailwind 4.x for nested CSS rules
    require('tailwindcss')({
      // You can add your Tailwind config here if needed,
      // though it's often in a separate tailwind.config.js file that Tailwind reads automatically.
      // For Hugo Pipes, ensure your content paths cover all relevant files.
      // Example content paths:
      // content: [
      //   './content/**/*.md',
      //   './layouts/**/*.html',
      //   './static/js/**/*.js', // If you have dynamic classes in JS
      // ],
    }),
    require('autoprefixer'), // Autoprefixer should also be required as a function
    // Add other PostCSS plugins here if you need them later, e.g.:
    // require('postcss-preset-env')({ stage: 1 }),
  ]
};
