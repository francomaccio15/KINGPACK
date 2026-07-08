#!/usr/bin/env bash
# KING PACK — auto-deploy basado en PULL.
#
# Corre periódicamente desde el propio VPS (systemd timer kingpack-deploy.timer).
# Si origin/master avanzó respecto al HEAD local, hace git pull + build + restart.
#
# Por qué pull y no push: los runners de GitHub Actions NO siempre alcanzan el
# puerto 22 del VPS (la red del proveedor bloquea de forma intermitente algunas
# IPs de los runners → "dial tcp 76.13.112.206:22: i/o timeout"). Al invertir la
# dirección (el VPS consulta a GitHub de forma SALIENTE) el deploy deja de
# depender de conexiones entrantes y se vuelve confiable.
#
# La copia que se ejecuta vive en /usr/local/bin/kingpack-auto-deploy.sh
# (fuera del repo, para que un pull no la edite a mitad de ejecución).
set -euo pipefail

REPO=/var/www/KINGPACK
ENV_FILE=frontend/.env.production           # trackeado pero con secreto local
ENV_BACKUP=/var/backups/kingpack.env.production
BRANCH=master

cd "$REPO"

log() { echo "[$(date '+%F %T')] $*"; }

git fetch --quiet origin "$BRANCH"
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

# Nada nuevo: salir en silencio (el timer corre cada minuto).
[ "$LOCAL" = "$REMOTE" ] && exit 0

log "Nuevo commit en $BRANCH: ${LOCAL:0:7} -> ${REMOTE:0:7}. Desplegando…"

# Preservar el .env.production local (contiene JWT_SECRET y demás, que NO están
# en git porque el repo es público). Se respalda, se limpia el árbol para que el
# ff-only nunca falle por cambios locales, y luego se restaura.
[ -f "$ENV_FILE" ] && cp -f "$ENV_FILE" "$ENV_BACKUP"
git checkout -- "$ENV_FILE" 2>/dev/null || true

git pull --ff-only

[ -f "$ENV_BACKUP" ] && cp -f "$ENV_BACKUP" "$ENV_FILE"

# ── Backend: dependencias + migraciones (idempotentes) ──────────────────────
( cd backend && npm install --omit=dev --no-audit --no-fund && node db/runner.js )

# ── Frontend: build SIN caída (ping-pong de directorios) ────────────────────
# Se compila en un directorio ALTERNO (.next / .next-build) mientras la versión
# anterior sigue sirviendo. Recién al terminar se reinicia el frontend apuntando
# al build nuevo (swap de unos segundos, no ~2 min). Si el build falla, set -e
# corta acá ANTES del swap y la versión vieja sigue online → sin caída.
( cd frontend && npm install --no-audit --no-fund )

LIVE=$(cat frontend/.next-live 2>/dev/null || echo .next)
if [ "$LIVE" = ".next" ]; then BUILD=.next-build; else BUILD=.next; fi
log "Compilando frontend en '$BUILD' (activo: '$LIVE')…"

# El rm del dir alterno limpia también el build viejo del deploy anterior.
( cd frontend && rm -rf "$BUILD" && NEXT_DIST_DIR="$BUILD" npm run build )

# Swap: el frontend arranca sirviendo el build nuevo (distDir = $BUILD, que
# coincide con lo grabado en required-server-files.json). Downtime ≈ el restart.
NEXT_DIST_DIR="$BUILD" pm2 restart ecosystem.config.js --only kingpack-frontend --update-env
echo "$BUILD" > frontend/.next-live

# Backend: sin build, reinicio breve.
pm2 restart ecosystem.config.js --only kingpack-backend --update-env
pm2 save --force

# ── Healthcheck del backend con reintentos (~30s) ───────────────────────────
ok=0
for i in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:3001/api/health >/dev/null; then
    ok=1; log "Backend OK (intento $i)"; break
  fi
  log "Backend aún no responde ($i/15)…"; sleep 2
done
[ "$ok" -ne 1 ] && { log "ERROR: el backend no respondió tras 30s"; exit 1; }

log "Deploy completado en ${REMOTE:0:7}."
