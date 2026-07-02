import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'KingPack — Gestión',
    short_name:       'KingPack',
    description:      'Sistema de gestión integral — King Pack',
    start_url:        '/',
    display:          'standalone',
    background_color: '#0d0d0d',
    theme_color:      '#0d0d0d',
    icons: [
      {
        src:  '/logo-symbol.png',
        sizes: '160x72',
        type:  'image/png',
      },
    ],
  };
}
