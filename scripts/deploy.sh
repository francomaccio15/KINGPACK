#!/usr/bin/env bash
# KINGPACK — Deploy script (corre EN el VPS)
# Pull cambios, instala deps, corre migraciones, builds frontend, reload PM2.
# Uso (desde local): ssh kingpack-vps "cd /var/www/KINGPACK && bash scripts/deploy.sh"
set -euo pipefail

APP_DIR=${APP_DIR:-/var/www/KINGPACK}
cd "$APP_DIR"

echo "═══ KINGPACK Deploy — $(date -u +'%Y-%m-%d %H:%M:%S UTC') ═══"

echo "[1/6] git pull..."
git pull --ff-only

echo "[2/6] Backend: npm install + migraciones..."
(cd backend && npm install --omit=dev --no-audit --no-fund)
(cd backend && node db/runner.js)

echo "[3/6] Frontend: npm install + build..."
(cd frontend && npm install --no-audit --no-fund)
# Build limpio: un .next de un build previo provoca ENOENT en collect-build-traces
# (busca .nft.json que no se regeneran) y deja artefactos viejos que el server
# sirve como "Could not find a production build". Borrarlo garantiza build sano.
(cd frontend && rm -rf .next && npm run build)

echo "[4/6] PM2 reload..."
if pm2 describe kingpack-backend >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js
else
  pm2 start ecosystem.config.js
  pm2 save
fi

echo "[5/6] Nginx reload..."
nginx -t && systemctl reload nginx

echo "[6/6] Health check..."
sleep 2
curl -fsS http://127.0.0.1:3001/api/health && echo
curl -fsS -o /dev/null -w "Frontend HTTP %{http_code}\n" http://127.0.0.1:3000/

echo "✓ Deploy OK."
