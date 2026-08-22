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

      // ── Responsive / mobile ────────────────────────────────────────────────
      // Breakpoint intermedio: en 320-474px casi nada entra en 2 columnas.
      screens: {
        xs: '475px',
      },
      // Piso tipografico de mobile (11px). Reemplaza a text-[9px]/[10px]/[11px],
      // que en un telefono son ilegibles. En desktop se sigue usando text-[10px]
      // via el prefijo md:, asi que no hay cambio visual en escritorio.
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      // 44px = minimo tactil recomendado. 36px = la altura real que tienen hoy
      // los controles en desktop (py-2 + text-sm), que hay que preservar.
      minHeight: {
        touch:      '44px',
        'touch-sm': '36px',
      },
      minWidth: {
        touch: '44px',
      },
      maxHeight: {
        sheet:  '92dvh',
        dsheet: '90dvh',
      },
      // Capas nombradas para no volver a tener colisiones de z-50 entre el
      // drawer del sidebar, los modales y los popovers.
      zIndex: {
        drawer: '40',
        modal:  '50',
        sheet:  '60',
        pop:    '70',
      },
      keyframes: {
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
      animation: {
        'sheet-in': 'sheet-in .22s cubic-bezier(.32,.72,0,1)',
        'fade-in':  'fade-in .15s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
