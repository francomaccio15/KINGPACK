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
# Parar el 'next start' viejo ANTES de construir: si sigue corriendo, compite con
# collect-build-traces (lee .next mientras next build lo regenera) y produce un
# ENOENT sobre *.nft.json que aborta el build. Pararlo lo evita.
if pm2 describe kingpack-frontend >/dev/null 2>&1; then
  pm2 stop kingpack-frontend || true
fi
# Build limpio: un .next de un build previo provoca ENOENT en collect-build-traces
# (busca .nft.json que no se regeneran) y deja artefactos viejos que el server
# sirve como "Could not find a production build". Borrarlo garantiza build sano.
(cd frontend && rm -rf .next && npm run build)

echo "[4/6] PM2..."
if pm2 describe kingpack-backend >/dev/null 2>&1; then
  # Backend: reload graceful (es node plano, sin estado de build en disco).
  pm2 reload kingpack-backend
  # Frontend: restart DURO, no reload. Tras el 'rm -rf .next' el proceso viejo de
  # 'next start' queda con referencias a chunks borrados -> MODULE_NOT_FOUND. Un
  # reload graceful no lo arregla; hay que matar y arrancar fresco contra el .next nuevo.
  #
  # IMPORTANTE: se fuerza NEXT_DIST_DIR=.next con --update-env. Sin esto, 'pm2
  # restart' conserva el entorno viejo del proceso; si alguna vez quedó apuntando
  # a .next-build, seguiría sirviendo ese build viejo aunque el deploy buildee en
  # .next (desfase crónico: el frontend "no se actualiza nunca").
  NEXT_DIST_DIR=.next pm2 restart kingpack-frontend --update-env
else
  pm2 start ecosystem.config.js
  pm2 save
fi

echo "[5/6] Nginx reload..."
nginx -t && systemctl reload nginx

echo "[6/6] Health check..."
curl -fsS http://127.0.0.1:3001/api/health && echo
# El frontend (next start) tarda unos segundos en quedar listo tras el restart;
# reintentar hasta 30s antes de dar el deploy por fallido.
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/login || true)
  if [ "$code" = "200" ]; then echo "Frontend HTTP 200 (listo en ${i}x2s)"; break; fi
  if [ "$i" = "15" ]; then echo "✗ Frontend no respondió 200 (último: $code)"; exit 1; fi
  sleep 2
done

echo "✓ Deploy OK."
