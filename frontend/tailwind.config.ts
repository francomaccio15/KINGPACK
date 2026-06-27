import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'kp-bg':       '#0d0d0d',
        'kp-surface':  '#1a1a1a',
        'kp-surface2': '#242424',
        'kp-border':   '#3a3a3a',
        'kp-red':      '#ff2233',
        'kp-red-dark': '#cc0000',
        'kp-white':    '#ffffff',
        'kp-gray':     '#eaeaea',
        'kp-gray-lt':  '#fafafa',
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
