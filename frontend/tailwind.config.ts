import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'kp-bg':       '#3d3d3d',
        'kp-surface':  '#4d4d4d',
        'kp-surface2': '#5c5c5c',
        'kp-border':   '#757575',
        'kp-red':      '#ff2233',
        'kp-red-dark': '#d40010',
        'kp-white':    '#ffffff',
        'kp-gray':     '#d4d4d4',
        'kp-gray-lt':  '#efefef',
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
