/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Deploy sin caída: build y start comparten el mismo directorio vía
  // NEXT_DIST_DIR (el deploy alterna entre .next y .next-build). Default .next
  // para desarrollo local y arranques manuales.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

module.exports = nextConfig;
