# Informe de seguridad — KingPack

Fecha: 10/11/2026 · Alcance: código del repo (backend Express, frontend Next.js), dependencias, historial de git y configuración de deploy/nginx que está versionada. El servidor (VPS) no se tocó: lo que hay que hacer ahí está en **Pendientes de servidor**.

> ⚠️ Este repo es **público**. Este informe no incluye contraseñas ni datos sensibles a propósito. Lo primero de la lista de pendientes es pasarlo a privado.

---

## 1. Urgente (hacer hoy)

| # | Hallazgo | Gravedad | Qué hacer |
|---|----------|----------|-----------|
| U1 | **Contraseñas reales en texto plano en el historial público de git.** El seed `backend/db/seeds/seed-distribuidora-admin.js` tenía la contraseña del usuario administrador de la distribuidora, y `seed-usuarios.js` tenía las de admin/supervisor/cajero/vendedor `@kingpack.com`. Cualquiera que vea el repo las puede leer. | **Crítica** | Cambiar YA esas contraseñas desde *Usuarios* (o desactivar las cuentas que no se usen). Ver consulta en P2. En el código ya no están (arreglo A9), pero siguen en el historial. |
| U2 | **Repo público con datos de clientes.** `KingPack.xlsx` y los seeds `012`–`022` contienen el padrón real (679 clientes y 28 proveedores con CUIT/CUIL, nombres, etc.). | **Crítica** | Pasar el repo a **privado** (P1). Es un dato personal publicado. |

---

## 2. Arreglos aplicados en el código

### Dependencias
| # | Antes | Después |
|---|-------|---------|
| A1 | `next 14.2.18`: 4 fallas **críticas** (ejecución remota de código en el optimizador de imágenes, bypass de autorización del middleware) y muchas altas. | `next 15.5.29` + `react/react-dom 19.2.9`. Migración de Next 15: `cookies()`, `params` y `searchParams` ahora son asíncronos (`requireAuth()` y `getSucursalActivaId()` pasaron a `async`). Ajustes de tipos de React 19 (`useRef`, `RefObject`). |
| A2 | `postcss` vulnerable (interno de Next). | `postcss 8.5.32` forzado con `overrides`. **Frontend: 0 vulnerabilidades.** |
| A3 | `node-forge ≤1.4.2` (alta: verificación de firmas RSA) — es el que firma el login con ARCA. `uuid <11.1.1` (moderada, vía `exceljs`). | `node-forge ^1.4.3`; `uuid ^11.1.1` vía `overrides` (probado: `exceljs` genera planillas bien). **Backend: 0 vulnerabilidades.** |
| — | Paquetes sin uso | Revisados: todos los del backend y frontend se usan. El `package.json` de la raíz es solo para scripts locales (no se instala en el VPS). |

### Autenticación y sesiones
| # | Hallazgo | Arreglo |
|---|----------|---------|
| A4 | El límite de intentos de login era **por IP**, y la IP que veía Express era la del nodo de Cloudflare (`trust proxy 1` + nginx). Todos los usuarios compartían el mismo contador y un atacante distribuido no tenía freno. | **Límite por cuenta**: 5 contraseñas erradas en 15 min bloquean esa cuenta 15 min, venga de la IP que venga. **Límite por IP real** (30/15 min) usando `CF-Connecting-IP` / `X-Real-IP`, nunca el primer valor de `X-Forwarded-For`. Validación de tipos del body (un email que no es texto daba 500). |
| A5 | Un usuario **desactivado o borrado** seguía entrando hasta 24 h con su token. Un cambio de **rol** no se aplicaba hasta volver a loguearse. | Cada request verifica en la base que el usuario siga activo y toma el **rol y la sucursal de la base**, no del token (caché de 30 s). |
| A6 | Cambiar la contraseña no cerraba las sesiones abiertas. | Columna nueva `usuarios.tokens_validos_desde` (migración `070`): al cambiar la contraseña se invalidan todos los tokens anteriores. |
| A7 | Contraseñas de mínimo 6 caracteres, bcrypt costo 10. | Mínimo 8 (máx. 200), bcrypt costo 12 para las nuevas. |
| A8 | El frontend comparaba la firma del JWT con `!==` (filtra tiempos). Cookie `kp_token` sin `Secure`. | Comparación en tiempo constante (`timingSafeEqual`). Cookie con `Secure` en HTTPS. |
| A9 | Contraseñas en texto plano en los scripts de seed. | `seed-usuarios.js` genera contraseñas al azar y las muestra una vez; `seed-distribuidora-admin.js` la toma de `ADMIN_PASSWORD`. |

### Rutas de admin y permisos
| # | Hallazgo | Arreglo |
|---|----------|---------|
| A10 | **`POST /api/arca/test-factura` lo podía usar cualquier usuario logueado** (cajero, vendedor). Con ARCA en modo producción eso emite un **comprobante fiscal real con CAE**. `test-auth` igual. `status` mostraba la ruta del certificado. | `test-factura` y `test-auth` solo administrador; `test-factura` **bloqueada fuera de demo/homologación**. La ruta del certificado solo la ve el admin. |
| A11 | Cualquier rol podía **modificar listas de precios, cuentas bancarias y rubros de gastos**, y entrar a **transportes, pagos de clientes y anticipos** (pantallas que en el frontend son solo de admin). | Escritura en listas de precios, cuentas bancarias y rubros: solo administrador (la lectura sigue abierta porque la usan ventas, caja, etc.). Transportes, pago-clientes y anticipos: solo administrador. |

### CSRF, CORS y cabeceras
| # | Hallazgo | Arreglo |
|---|----------|---------|
| A12 | CORS apuntaba a `FRONTEND_URL`, que en producción vale `http://76.13.112.206` (no al dominio). Sin chequeo de Origin. | API: toda mutación con `Origin` de otro sitio → 403; preflight CORS de otros sitios → 403; cabeceras CORS solo para los orígenes de `FRONTEND_URL` (acepta lista separada por comas). El mismo dominio (`/api` por nginx) sigue andando aunque `FRONTEND_URL` esté mal (igual conviene corregirlo, P4). |
| A13 | El frontend **no mandaba ninguna cabecera de seguridad** y exponía `X-Powered-By: Next.js`. | CSP completo con todo en `'self'` (más `blob:` para PDF/Excel), `frame-ancestors 'none'`, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP; sin `X-Powered-By`. **No** se agregó redirección a HTTPS en la app (detrás de Cloudflare + nginx provoca bucles; lo fuerzan ellos). |
| A14 | Ruta `POST /api/sucursal` del frontend sin chequeo de origen y aceptaba cualquier texto en la cookie. | `src/middleware.ts` rechaza mutaciones y preflights de otros orígenes; la ruta solo acepta un UUID; cookie con `Secure`. |
| A15 | API: CSP de helmet pensado para HTML. | CSP `default-src 'none'` (la API solo devuelve JSON) y `X-Frame-Options: DENY`. |

### Vigilancia
| # | Arreglo |
|---|---------|
| A16 | Tabla `eventos_seguridad` + `services/seguridad.js`. Se registran: login fallido, bloqueo de cuenta, límite por IP, token con firma inválida (fabricado), token de usuario inactivo/revocado, acceso denegado por rol, pedido desde otro origen y cambio de contraseña. Todo sale además en el log con la etiqueta **`[security]`**. |
| A17 | **Alerta en la campanita de los administradores**: "Seguridad (24 h): N bloqueos, N logins fallidos, N accesos sospechosos". |

### Errores y XSS
| # | Hallazgo | Arreglo |
|---|----------|---------|
| A18 | `/api/health` (público) devolvía el mensaje de error de Postgres (puede revelar host/usuario). | Devuelve solo `db: down`; el detalle va al log. |
| A19 | JSON mal formado devolvía 500. | 400 / 413 según el caso. El manejador de errores nunca devuelve detalle ni stack. |
| A20 | La impresión del cierre de caja escribía el nombre de la sucursal en HTML sin escapar. | Escapado. No hay `dangerouslySetInnerHTML` ni `eval` en el código. |

### Revisado y sin problemas
- **Contraseñas**: se guardan con bcrypt; el login tarda lo mismo exista o no el email.
- **SQL**: todas las consultas son parametrizadas (`$1, $2…`). Los nombres de tabla que se arman dinámicamente salen de listas fijas en el código, nunca del request.
- **JWT**: firma HS256 fija (`alg=none` rechazado), secreto obligatorio al arrancar.
- **Claves de API** (ARCA, JWT, base): solo del lado del servidor. En el navegador solo llega `NEXT_PUBLIC_API_URL`.
- **Archivos `.env`**: nunca se commitearon con secretos (el `frontend/.env.production` versionado solo tiene URLs).
- **Modo debug**: pm2 corre con `NODE_ENV=production` y Next con build de producción.

---

## 3. Pruebas

`node backend/scripts/test-seguridad.js` levanta la API real con una base simulada en memoria (no toca ninguna base) y prueba 21 casos. **Resultado: 21 OK, 0 fallidas.**

- login correcto; email no-texto → 400; JSON roto → 400
- 5 claves erradas bloquean la cuenta aunque cambie la IP
- límite por IP real; un `X-Forwarded-For` falso no lo esquiva
- sin token → 401; firma falsa → 401 + evento; `alg=none` → 401
- usuario desactivado → 401; token anterior al cambio de clave → 401
- cajero con token que dice "administrador" → 403 (manda el rol de la base)
- cajero → factura de prueba ARCA 403; admin en modo producción → 403
- cajero → modificar listas de precios / cuentas bancarias / rubros → 403 (leer sí)
- vendedor → transportes, pago-clientes, anticipos, usuarios → 403 + evento
- POST y preflight desde otro sitio → 403; preflight del frontend → 204 con CORS
- cabeceras de seguridad presentes y sin `X-Powered-By`

Frontend: `tsc` sin errores y `next build` OK. Con el build de producción: cabeceras presentes en `/login`, POST/OPTIONS a `/api/sucursal` desde otro origen → 403, mismo origen → 200, página sin sesión redirige a `/login`, y en el navegador la página hidrata sin violaciones de CSP en la consola.

**No probado** (no hay Postgres en la máquina de desarrollo): el recorrido completo con la base real. Después del deploy conviene entrar con cada rol y recorrer ventas, caja, presupuestos y PDF/Excel (ver P9).

---

## 4. Pendientes de servidor (los hace Franco a mano)

> No tocar nada de la Consultora en el VPS. Los comandos son para correr **dentro** del VPS (con PowerShell, mejor entrar con `ssh` y escribirlos ahí, no pasarlos como argumento).

**P1 — Repo privado (orden importante, si no se rompe el auto-deploy).** El VPS hace `git fetch` por HTTPS anónimo; con el repo privado eso falla.
1. En el VPS: `ssh-keygen -t ed25519 -f /root/.ssh/kingpack_deploy -N ""` y cargar la `.pub` en GitHub → repo → Settings → Deploy keys (solo lectura).
2. En `/root/.ssh/config`: `Host github-kingpack` / `HostName github.com` / `IdentityFile /root/.ssh/kingpack_deploy`.
3. `cd /var/www/KINGPACK && git remote set-url origin git@github-kingpack:francomaccio15/KINGPACK.git && git fetch` (tiene que andar).
4. Recién ahí: GitHub → Settings → Change visibility → Private.
5. Opcional: limpiar el historial (`git filter-repo`) para sacar `KingPack.xlsx`, los seeds con datos reales y las contraseñas. Con el repo privado y las contraseñas cambiadas deja de ser urgente.

**P2 — Contraseñas expuestas (U1).** Ver qué cuentas existen:
```sql
SELECT email, rol, activo, created_at FROM usuarios WHERE deleted_at IS NULL ORDER BY created_at;
```
Cambiar la contraseña de la cuenta de la distribuidora y de cualquier `admin@ / supervisor@ / cajero@ / vendedor@kingpack.com` que exista (o desactivarlas). Ahora el cambio cierra las sesiones abiertas.

**P3 — `JWT_SECRET`.** Si al arrancar el backend aparece `[security] JWT_SECRET tiene menos de 32 caracteres`, rotarlo por uno largo (`openssl rand -base64 48`) en `/var/www/KINGPACK/.env` **y** en `frontend/.env.production` (tienen que ser iguales), y reiniciar ambos con pm2. Desloguea a todos.

**P4 — `FRONTEND_URL`.** En `/var/www/KINGPACK/.env` poner `FRONTEND_URL=https://kingpack.macciotec.com` (hoy es `http://76.13.112.206`) y `pm2 restart kingpack-backend --update-env`.

**P5 — nginx de KingPack** (`/etc/nginx/sites-enabled/kingpack`, solo ese archivo):
- Que el origen solo acepte a Cloudflare, para que nadie pueda saltearlo y falsificar `CF-Connecting-IP`: `set_real_ip_from` con los rangos de https://www.cloudflare.com/ips/ + `real_ip_header CF-Connecting-IP;` y/o firewall del 443 solo para esos rangos (ojo: el firewall afecta también a la Consultora; si se hace, que sea con los mismos rangos para los dos).
- `server_tokens off;`
- Después: `nginx -t && systemctl reload nginx`.

**P6 — Cloudflare**: SSL/TLS en **Full (strict)** y "Always Use HTTPS" activado.

**P7 — Puertos de Docker.** Verificar que Postgres y Redis no escuchen hacia afuera:
```bash
docker port kingpack_postgres; docker port kingpack_redis; ss -tlnp | grep -E ':5432|:6379'
```
Tienen que estar en `127.0.0.1`. El código no usa Redis: si no lo usa nada más, se puede apagar `kingpack_redis`.

**P8 — Backups y procesos.** Preservar los crons de root (pg_dump 3:00 y cheques 3:30). Agregar `umask 077` al script de pg_dump para que los dumps queden `600`, y revisar `ls -l` de los backups existentes. A futuro: correr pm2 con un usuario sin privilegios en vez de root.

**P9 — Después del deploy** (el auto-deploy corre la migración `070` solo):
```bash
pm2 logs kingpack-backend --lines 50
curl -sI https://kingpack.macciotec.com/login | grep -iE 'content-security|x-frame|strict-transport'
pm2 logs kingpack-backend | grep '\[security\]'
```
Y entrar con cada rol (admin, cajero, supervisor, vendedor, comercial) para recorrer ventas, caja, presupuestos y exportar un PDF y un Excel.

---

## 5. Riesgos que quedan (decisión pendiente)

- **Token en `localStorage` y cookie legible por JS.** Si alguna vez hubiera un XSS, el token se podría robar. Lo mitigan React (escapa todo), el CSP nuevo y la ausencia de HTML crudo. El arreglo de fondo es una cookie `HttpOnly` con el frontend como intermediario: implica tocar ~100 archivos que llaman a la API directo.
- **CSP con `script-src 'unsafe-inline'`**: Next App Router lo necesita salvo que se usen nonces (requiere render dinámico de todo).
- **Rol vendedor (repartidor)**: el backend no le limita los endpoints como al rol comercial (lo limita solo el menú del frontend). Conviene una lista blanca igual que la de comercial.
- **Bloqueo por cuenta en memoria**: se reinicia con cada deploy/reinicio del backend.
- **`package-lock.json` en `.gitignore`**: cada deploy resuelve versiones nuevas dentro de los rangos. Conviene versionar los lockfiles para builds reproducibles.
