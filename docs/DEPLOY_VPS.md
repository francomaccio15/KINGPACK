# KingPack — Guía de Deploy al VPS

> **Para devs y para sus agentes de IA (Claude / Cursor / etc.):** este archivo es la fuente de verdad para conectarse al servidor productivo de KingPack y desplegar cambios. Léelo completo antes de tocar el VPS.

---

## 0) Resumen ejecutivo

- **VPS productivo:** `76.13.112.206` (Ubuntu 24.04 LTS)
- **App en VPS:** `/var/www/KINGPACK`
- **URL pública:** `http://76.13.112.206/articulos`
- **Stack en el server:** PostgreSQL 16 (Docker) + Redis 7 (Docker) + Node 20 + PM2 + Nginx
- **Procesos PM2:** `kingpack-backend` (`:3001`) y `kingpack-frontend` (`:3000`)
- **Reverse proxy:** Nginx en `:80` → `/` al frontend, `/api/*` al backend
- **Backups:** `pg_dump` diario 03:00 UTC en `/var/backups/kingpack` (retención 14 días)
- **Repo:** https://github.com/francomaccio15/KINGPACK (rama `master`)

**Regla de oro:** todos los cambios productivos se deployean con `scripts/deploy.ps1` (Windows) o `scripts/deploy.sh` ejecutado en el VPS. **Nunca** se editan archivos a mano en el servidor.

---

## 1) Credenciales

| Recurso | Valor |
|---|---|
| Host VPS | `76.13.112.206` |
| Usuario SSH | `root` |
| Password root (solo 1ª vez para copiar tu clave) | *pedírsela a Ivan/Franco por canal privado* |
| Repo GitHub | `https://github.com/francomaccio15/KINGPACK` |
| Branch productivo | `master` |
| Password PostgreSQL | está en el VPS en `/root/.kingpack-vps.env` (chmod 600). **No copiar a local salvo necesidad puntual.** |

**No commitear nunca:** `.env`, claves SSH privadas, dumps con datos reales, passwords.

---

## 2) Setup inicial de tu máquina (una sola vez por dev)

### 2.1 Requisitos
- Git
- Node.js 20 LTS (`node --version` → `v20.x`)
- OpenSSH client (Windows 10/11 ya lo trae)
- PowerShell 5+ (Windows) o bash (Mac/Linux)

### 2.2 Generar tu clave SSH para KingPack

**Importante:** no reutilices tu clave personal — generá una dedicada para este proyecto.

**Windows (PowerShell):**
```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\id_ed25519_kingpack" -N '""' -C "kingpack-vps-<tu-nombre>"
```

**Mac/Linux (bash):**
```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_kingpack -N "" -C "kingpack-vps-$(whoami)"
```

### 2.3 Configurar el alias `kingpack-vps`

Editá `~/.ssh/config` (Windows: `C:\Users\<vos>\.ssh\config`) y agregá:

```
Host kingpack-vps
    HostName 76.13.112.206
    User root
    IdentityFile ~/.ssh/id_ed25519_kingpack
    IdentitiesOnly yes
    ServerAliveInterval 30
```

### 2.4 Pedir que se autorice tu clave pública en el VPS

Mandale a Ivan/Franco el contenido de tu clave **pública** (no la privada):

```powershell
# Windows
Get-Content "$env:USERPROFILE\.ssh\id_ed25519_kingpack.pub"
```
```bash
# Mac/Linux
cat ~/.ssh/id_ed25519_kingpack.pub
```

Ellos la agregan al `~/.ssh/authorized_keys` del VPS. Mientras tanto, podés validar localmente que la clave existe y el alias está bien.

### 2.5 Validar la conexión

```powershell
ssh kingpack-vps "echo OK && hostname && uptime"
```

Debe responder sin pedirte password. Si pide password → tu clave aún no fue autorizada.

### 2.6 Clonar el repo

```powershell
git clone https://github.com/francomaccio15/KINGPACK.git
cd KINGPACK
```

---

## 3) Setup del entorno local de desarrollo

### 3.1 Variables de entorno
Copiá el template y completá:
```powershell
Copy-Item .env.example .env
```
Para desarrollo local con Postgres del VPS **NO se conectan directo**. Usá un Postgres local (recomendado: Docker). Pedile a un dev senior la `DATABASE_URL` apropiada o usá:
```
DATABASE_URL=postgresql://kingpack_app:kingpack@localhost:5432/kingpack
```

### 3.2 Instalar deps
```powershell
cd backend && npm install
cd ../frontend && npm install
```

### 3.3 Correr migraciones en tu Postgres local
```powershell
cd backend && npm run migrate
```

### 3.4 Levantar en dev
Dos terminales:
```powershell
# Terminal 1 — backend
cd backend && npm run dev
# Terminal 2 — frontend
cd frontend && npm run dev
```
Abrí `http://localhost:3000/articulos`.

---

## 4) Metodología de deploy — **la única forma correcta**

### 4.1 Flujo estándar (Windows)

```powershell
# 1. Asegurate de tener todo commiteado en la rama master
git status
git checkout master
git pull origin master

# 2. Hacé tus cambios, commiteá
git add .
git commit -m "feat: <descripción>"

# 3. Deploy
.\scripts\deploy.ps1
```

El script `deploy.ps1`:
1. Valida que el repo esté limpio.
2. Valida que estés en `master`.
3. Hace `git push origin master`.
4. Conecta vía SSH al VPS.
5. Ejecuta `scripts/deploy.sh` allá, que hace:
   - `git pull --ff-only`
   - `npm install` en backend y frontend
   - `node db/runner.js` (aplica migraciones nuevas, **idempotente**)
   - `npm run build` en frontend
   - `pm2 reload ecosystem.config.js` (reinicio sin downtime)
   - `nginx -t && systemctl reload nginx`
   - Health check interno.
6. Smoke test público desde tu local a `http://76.13.112.206/api/health`.

### 4.2 Mac/Linux
Hacé manualmente lo que hace `deploy.ps1`:
```bash
git push origin master
ssh kingpack-vps "cd /var/www/KINGPACK && bash scripts/deploy.sh"
curl http://76.13.112.206/api/health
```

### 4.3 Reglas no negociables

- **Nunca** edites archivos directamente en el VPS (`vim /var/www/...`). Si lo hacés, el próximo `git pull` los pisa o conflictúa.
- **Nunca** hagas `git push --force` a `master`.
- **Nunca** commitees `.env`, `node_modules/`, `.next/`, dumps SQL.
- Las migraciones **solo se agregan**, nunca se modifican. Si necesitás cambiar algo de una migración ya aplicada → creá una migración nueva con número siguiente.
- Si un deploy falla, **no** intentes "arreglarlo" desde el VPS. Revertí el commit, hacé deploy de nuevo.

---

## 5) Estructura del proyecto

```
KINGPACK/
├── backend/                      Node + Express API
│   ├── package.json
│   ├── src/
│   │   ├── index.js              Entry point Express
│   │   ├── config/db.js          Pool PostgreSQL + queryWithUser (auditoría)
│   │   └── routes/               Routers Express (uno por dominio)
│   └── db/
│       ├── runner.js             Aplica migrations + seeds (idempotente)
│       ├── migrations/           SQL — solo agregar, nunca modificar
│       └── seeds/                Datos maestros (AFIP, roles, etc.)
├── frontend/                     Next.js 14 (App Router) + TS + Tailwind
│   ├── package.json
│   └── src/app/                  Server Components + páginas
├── deploy/
│   └── nginx_kingpack.conf       Config de Nginx (copiada al VPS por deploy.sh)
├── scripts/
│   ├── setup_vps_postgres.sh     One-time setup del VPS
│   ├── deploy.sh                 Corre EN el VPS — invocado por deploy.ps1
│   └── deploy.ps1                Corre EN local Windows — flujo estándar
├── ecosystem.config.js           PM2 (backend + frontend)
└── AGENTS.md                     Reglas de arquitectura — leer antes de codear
```

---

## 6) Operaciones comunes en el VPS

Todo se hace vía SSH con el alias `kingpack-vps`. **Lectura sí, escritura no** (excepto vía deploy script).

### Ver procesos y logs
```bash
ssh kingpack-vps "pm2 status"
ssh kingpack-vps "pm2 logs kingpack-backend --lines 50 --nostream"
ssh kingpack-vps "pm2 logs kingpack-frontend --lines 50 --nostream"
```

### Health
```bash
curl http://76.13.112.206/api/health
ssh kingpack-vps "docker exec kingpack_postgres pg_isready -U kingpack_app -d kingpack"
```

### Conectarse a PostgreSQL (solo lectura sugerida)
```bash
ssh kingpack-vps "docker exec -it kingpack_postgres psql -U kingpack_app -d kingpack"
```
**No corras `UPDATE`/`DELETE`/`DROP` ad-hoc en producción.** Cualquier cambio de datos productivo va por migración o por endpoint de la app.

### Ver backups
```bash
ssh kingpack-vps "ls -lh /var/backups/kingpack"
```

### Restaurar un backup (procedimiento de emergencia — coordinar con Ivan)
```bash
ssh kingpack-vps "gunzip < /var/backups/kingpack/YYYY-MM-DD.sql.gz | docker exec -i kingpack_postgres psql -U kingpack_app -d kingpack"
```

---

## 7) Cómo agregar funcionalidad (workflow)

### 7.1 Endpoint backend nuevo
1. Crear `backend/src/routes/<nombre>.js` siguiendo el patrón de `articulos.js`.
2. Montarlo en `backend/src/index.js` con `app.use('/api/<nombre>', router)`.
3. **Auth obligatoria** salvo justificación documentada (ver `AGENTS.md`).
4. **Multi-sucursal:** todo endpoint que toque datos transaccionales filtra por `sucursal_id` del usuario (ver `queryWithUser`).

### 7.2 Migración de schema
1. Crear `backend/db/migrations/NNN_<nombre>.sql` con el siguiente número.
2. Solo `CREATE`/`ALTER ADD`/`CREATE INDEX`. **Nunca** modificar archivos previos.
3. Si necesitás dropear/renombrar, hacelo en una migración nueva con justificación en el commit.
4. Probá la migración localmente (`npm run migrate`) antes de pushear.
5. El runner es transaccional: si algo falla, hace ROLLBACK total.

### 7.3 Pantalla frontend nueva
1. Crear `frontend/src/app/<ruta>/page.tsx` (App Router de Next 14).
2. Server Component por default (fetch en el servidor con `API_URL_INTERNAL`).
3. Para fetch desde el cliente, usar `NEXT_PUBLIC_API_URL`.
4. Tailwind para estilos. Reutilizar los tokens de marca: `kingpack` (`#0a3d62`), `kingpack-accent` (`#f7b733`).

---

## 8) Troubleshooting rápido

| Síntoma | Diagnóstico | Solución |
|---|---|---|
| `ssh kingpack-vps` pide password | Tu clave no está autorizada en el VPS | Pedile a Ivan/Franco que agregue tu `.pub` |
| `deploy.ps1` falla con "repo dirty" | Tenés cambios sin commitear | `git status` → commiteá o `git stash` |
| Frontend devuelve 502 Bad Gateway | Next.js no levantó | `ssh kingpack-vps "pm2 logs kingpack-frontend --lines 100 --nostream"` |
| `/api/*` devuelve 502 | Backend Express crasheó | `ssh kingpack-vps "pm2 restart kingpack-backend && pm2 logs kingpack-backend"` |
| Migración rompió producción | Runner es transaccional, no debería pasar — pero si pasó | Restaurar backup más reciente (sección 6) |
| Postgres no responde | Container caído | `ssh kingpack-vps "docker start kingpack_postgres && docker logs kingpack_postgres --tail 50"` |

---

## 9) Instrucciones para tu agente de IA (Claude, Cursor, etc.)

> **Pegale este bloque al inicio de tu sesión con el asistente, o guardalo en su memoria del proyecto.**

```
Estás trabajando en el proyecto KingPack.

Servidor productivo: VPS 76.13.112.206, alias SSH `kingpack-vps`,
app en /var/www/KINGPACK. Reglas:

1. Para deployar cambios al VPS, SIEMPRE usar `scripts/deploy.ps1` (Windows)
   o el equivalente bash (push + ssh + scripts/deploy.sh). NUNCA editar
   archivos directamente en el servidor.
2. Antes de deployar: commit + push a master. El script lo valida.
3. Migraciones de DB: solo se AGREGAN archivos nuevos en
   backend/db/migrations/ con prefijo numérico siguiente. NUNCA modificar
   migraciones ya aplicadas.
4. Endpoints `/api/*`: requieren auth salvo `/api/auth/*`. Multi-sucursal:
   filtrar por sucursal_id del usuario en todas las queries de datos
   transaccionales.
5. Queries parametrizadas siempre ($1, $2, ...). Nunca string interpolation.
6. Frontend: Next.js 14 App Router. Server Components por default.
   Tailwind para estilos.
7. Detalles completos: leer `docs/DEPLOY_VPS.md` y `AGENTS.md` en el repo.
8. Si no tenés clave SSH configurada para `kingpack-vps`, pedile al usuario
   que siga la sección 2 de `docs/DEPLOY_VPS.md`. No pidas la password de
   root salvo que sea para el primer setup.
9. Antes de cualquier acción destructiva (drop, force-push, restore de
   backup), pedile confirmación al usuario.
```

---

## 10) Contactos

- **Ivan Maccio** — MaccioTEC (responsable técnico) — ivanmaccio12@gmail.com
- **Franco Maccio** — Dueño de MaccioTEC — +549 387 462-4579

Para password root, clave del Postgres, o accesos especiales: **pedirlos por canal privado**, nunca por chat público ni email sin cifrar.
