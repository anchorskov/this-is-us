// 📄 uno.config.mjs
import { defineConfig }      from 'unocss'
import { presetWind3 }       from '@unocss/preset-wind3'
import { presetAttributify } from '@unocss/preset-attributify'
import { presetIcons }       from '@unocss/preset-icons'

export default defineConfig({
  /* ------------------------------------------------------------------
   * Dark-mode strategy
   * ----------------------------------------------------------------- */
  dark: 'class',         // `.dark …` utilities now activate correctly

  /* ------------------------------------------------------------------
   * Tell UnoCSS where to look for class names:
   *  – Hugo templates
   *  – Markdown that renders to HTML
   *  – Every JS file that injects classes
   * ----------------------------------------------------------------- */
  content: {
    include: [
      // Templates & partials
      'layouts/**/*.{html,js}',
      // Markdown & rendered HTML
      'content/**/*.{md,html}',
      // Client-side scripts (static/js/**)
      'static/js/**/*.js',
    ],
    // exclude: ['node_modules', '.git'], // (optional)
  },

  /* ------------------------------------------------------------------
   * Presets
   * ----------------------------------------------------------------- */
  presets: [
    presetWind3(),        // Tailwind-compatible utilities
    presetAttributify(),  // [attr="p-4 text-red"] syntax
    presetIcons(),        // icon-* utilities
  ],

  /* ------------------------------------------------------------------
   * Shortcuts
   * ----------------------------------------------------------------- */
  shortcuts: {
    /* ── Theme-aware colour helpers ───────────────────────────── */
    'text-primary' : 'text-[var(--fg)]',   // flips with .dark
    'bg-primary'   : 'bg-[var(--bg)]',
    /* ── Hero buttons ─────────────────────────────────────────────── */
    'hero-btn':
      'inline-flex flex-col items-center justify-center p-6 rounded-2xl ' +
      'shadow-lg text-center transition transform duration-300 hover:scale-105',

    'hero-main-cta': 'hero-btn bg-green-500 text-white hover:bg-green-600',
    'hero-nav-btn' : 'hero-btn bg-red-600   text-white hover:bg-red-700',

    /* ── Town-Hall input (darker border + focus ring) ─────────────── */
    'th-input':
      'w-full border-2 border-gray-600 rounded-md p-2 ' +
      'focus:(outline-none ring-2 ring-blue-500 border-blue-500)',
    
  },

  /* ------------------------------------------------------------------
   * Theme tweaks
   * ----------------------------------------------------------------- */
  theme: {
    fontFamily: {
      inter            : ['Inter', 'sans-serif'],
      'material-icons' : ['Material Icons', 'sans-serif'],
    },
  },
})
