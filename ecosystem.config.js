module.exports = {
  apps: [
    {
      name: 'kingpack-backend',
      cwd: './backend',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        TZ: 'America/Argentina/Buenos_Aires',
      },
    },
    {
      name: 'kingpack-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        TZ: 'America/Argentina/Buenos_Aires',
        // Directorio de build activo (deploy sin caída). Lo fija el auto-deploy
        // al alternar entre .next y .next-build; default .next.
        NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next',
      },
    },
  ],
};
