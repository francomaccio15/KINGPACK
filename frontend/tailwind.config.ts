import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'kp-bg':       '#1c1c1c',
        'kp-surface':  '#2a2a2a',
        'kp-surface2': '#373737',
        'kp-border':   '#454545',
        'kp-red':      '#ff1a2b',
        'kp-red-dark': '#cc0000',
        'kp-white':    '#ffffff',
        'kp-gray':     '#b0b0b0',
        'kp-gray-lt':  '#dcdcdc',
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
