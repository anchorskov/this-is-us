/*
 * File: /tailwind.config.js
 * Description: Main configuration file for Tailwind CSS v3.
 * Defines which files Tailwind should scan for utility classes.
 * Dependencies:
 * - tailwindcss: ^3.4.4
 */
module.exports = {
  content: [
    './layouts/**/*.{html,js}',
    './content/**/*.{html,md}',
    './assets/js/**/*.js'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

