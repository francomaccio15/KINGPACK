import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'kp-bg':       '#0d0d0d',
        'kp-surface':  '#1a1a1a',
        'kp-surface2': '#242424',
        'kp-border':   '#2d2d2d',
        'kp-red':      '#e3000f',
        'kp-red-dark': '#b80000',
        'kp-white':    '#ffffff',
        'kp-gray':     '#8a8a8a',
        'kp-gray-lt':  '#c0c0c0',
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
