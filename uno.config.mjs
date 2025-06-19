import { defineConfig } from 'unocss'
import { presetWind3 }      from '@unocss/preset-wind3'
import { presetAttributify} from '@unocss/preset-attributify'
import { presetIcons }      from '@unocss/preset-icons'

export default defineConfig({
  // scan your Hugo templates + content + scripts for class names:
  content: {
    pipeline: {
      include: [
        './layouts/**/*.{html,js}',
        './content/**/*.{md,html}',
        './assets/js/**/*.js',
      ]
    }
  },
  presets: [
    presetWind3(),
    presetAttributify(),
    presetIcons(),
  ],
  shortcuts: {
    'hero-button':   'inline-flex flex-col items-center justify-center p-6 rounded-2xl shadow-lg text-center transition transform duration-300 hover:scale-105',
    'hero-main-cta': 'hero-button bg-green-500 text-white hover:bg-green-600',
    'hero-nav-btn':  'hero-button bg-red-600 text-white hover:bg-red-700',
  },
  theme: {
    fontFamily: {
      inter:             ['Inter','sans-serif'],
      'material-icons':  ['Material Icons','sans-serif'],
    }
  }
})
