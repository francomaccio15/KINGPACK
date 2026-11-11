/** @type {import('next').NextConfig} */

// Origen del backend que llama el navegador (NEXT_PUBLIC_API_URL). En producción
// es el mismo dominio (https://kingpack.macciotec.com → nginx /api), así que
// 'self' alcanza; si apunta a otro origen se suma al connect-src del CSP.
function apiOrigin() {
  try { return new URL(process.env.NEXT_PUBLIC_API_URL || '').origin; } catch { return ''; }
}

const isDev = process.env.NODE_ENV !== 'production';

// CSP: todo en 'self'. Next (App Router) inyecta scripts inline para hidratar,
// por eso script-src necesita 'unsafe-inline'. 'unsafe-eval' solo en desarrollo
// (lo usa el HMR). blob: para abrir/descargar los PDF y Excel generados.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin()}${isDev ? ' ws: wss:' : ''}`.trim(),
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // HTTPS lo fuerzan Cloudflare y nginx; acá solo se le pide al navegador que
  // no vuelva a intentar por HTTP. NO agregar una redirección a HTTPS en la app
  // (detrás del proxy provoca un bucle).
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Deploy sin caída: build y start comparten el mismo directorio vía
  // NEXT_DIST_DIR (el deploy alterna entre .next y .next-build). Default .next
  // para desarrollo local y arranques manuales.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
