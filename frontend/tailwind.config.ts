import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        kingpack: {
          DEFAULT: '#0a3d62',
          accent: '#f7b733',
        },
      },
    },
  },
  plugins: [],
};

export default config;
