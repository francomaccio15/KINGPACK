#!/usr/bin/env bash
# KINGPACK — Setup inicial del VPS
# Instala Docker, Node 20, PM2, Nginx; levanta Postgres 16 + Redis 7; backups; firewall.
# Ejecutar una sola vez: ssh kingpack-vps "POSTGRES_PASSWORD='xxx' bash -s" < scripts/setup_vps_postgres.sh
set -euo pipefail

POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-"CHANGE_ME_strong_password"}
POSTGRES_DB="kingpack"
POSTGRES_USER="kingpack_app"
BACKUP_DIR="/var/backups/kingpack"
DATA_DIR="/var/lib/kingpack"
APP_DIR="/var/www/KINGPACK"

echo "═══ KINGPACK VPS Setup ═══"

# ── Docker ────────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "[1/8] Instalando Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  echo "[1/8] Docker ya instalado — skip"
fi

# ── Node.js 20 LTS ────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null || ! node --version | grep -q "^v20\."; then
  echo "[2/8] Instalando Node.js 20 LTS..."
  # Remover Node distro-shipped (Ubuntu 24.04 trae 18 sin npm) si existe
  apt-get remove -y nodejs libnode-dev libnode72 libnode109 2>/dev/null || true
  apt-get autoremove -y 2>/dev/null || true
  # Esperar lock de apt si otro proceso lo tiene
  for i in 1 2 3 4 5 6; do
    if ! fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 && ! fuser /var/lib/apt/lists/lock >/dev/null 2>&1; then
      break
    fi
    echo "      apt locked, waiting 10s... ($i/6)"
    sleep 10
  done
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "[2/8] Node 20 ya instalado — skip"
fi

# ── PM2 ───────────────────────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  echo "[3/8] Instalando PM2..."
  npm install -g pm2
  pm2 startup systemd -u root --hp /root >/dev/null
else
  echo "[3/8] PM2 ya instalado — skip"
fi

# ── Nginx ─────────────────────────────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
  echo "[4/8] Instalando Nginx..."
  apt-get update -y
  apt-get install -y nginx
  systemctl enable --now nginx
else
  echo "[4/8] Nginx ya instalado — skip"
fi

# ── Directorios ───────────────────────────────────────────────────────────────
echo "[5/8] Creando directorios..."
mkdir -p "$DATA_DIR/postgres" "$DATA_DIR/redis" "$BACKUP_DIR" "$APP_DIR"
chmod 700 "$BACKUP_DIR"

# ── Postgres 16 ───────────────────────────────────────────────────────────────
echo "[6/8] Levantando kingpack_postgres..."
if docker ps -a --format '{{.Names}}' | grep -q "^kingpack_postgres$"; then
  echo "      Contenedor ya existe — preservando datos."
else
  docker run -d \
    --name kingpack_postgres \
    --restart unless-stopped \
    -e POSTGRES_DB="$POSTGRES_DB" \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -v "$DATA_DIR/postgres":/var/lib/postgresql/data \
    -p 127.0.0.1:5432:5432 \
    postgres:16-alpine
fi

# ── Redis 7 ───────────────────────────────────────────────────────────────────
echo "[7/8] Levantando kingpack_redis..."
if docker ps -a --format '{{.Names}}' | grep -q "^kingpack_redis$"; then
  echo "      Contenedor ya existe — preservando datos."
else
  docker run -d \
    --name kingpack_redis \
    --restart unless-stopped \
    -v "$DATA_DIR/redis":/data \
    -p 127.0.0.1:6379:6379 \
    redis:7-alpine redis-server --save 60 1 --loglevel warning
fi

# ── Cron pg_dump + Firewall ───────────────────────────────────────────────────
echo "[8/8] Configurando backups + firewall..."
CRON_JOB='0 3 * * * docker exec kingpack_postgres pg_dump -U '"$POSTGRES_USER"' '"$POSTGRES_DB"' | gzip > '"$BACKUP_DIR"'/$(date +\%Y-\%m-\%d).sql.gz && find '"$BACKUP_DIR"' -name "*.sql.gz" -mtime +14 -delete'
(crontab -l 2>/dev/null | grep -v kingpack_postgres; echo "$CRON_JOB") | crontab -

if command -v ufw &>/dev/null; then
  ufw allow 22/tcp >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
fi

# Persistir password en /root para futuras consultas (solo root, 600)
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" > /root/.kingpack-vps.env
echo "DATABASE_URL=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB" >> /root/.kingpack-vps.env
chmod 600 /root/.kingpack-vps.env

echo ""
echo "✓ Setup completo."
echo "  PostgreSQL: 127.0.0.1:5432  DB=$POSTGRES_DB  USER=$POSTGRES_USER"
echo "  Redis:      127.0.0.1:6379"
echo "  Node:       $(node --version 2>/dev/null || echo 'N/A')"
echo "  PM2:        $(pm2 --version 2>/dev/null || echo 'N/A')"
echo "  Nginx:      $(nginx -v 2>&1)"
echo "  App dir:    $APP_DIR"
echo "  Backups:    $BACKUP_DIR (cron 03:00 UTC, retención 14 días)"
echo "  Creds:      /root/.kingpack-vps.env (chmod 600)"
