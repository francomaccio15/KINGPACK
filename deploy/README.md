# Deploy de KING PACK

El deploy es **basado en pull**: lo ejecuta el propio VPS, no GitHub.

## Por qué

Los runners de GitHub Actions no siempre logran conectarse al puerto 22 del VPS
(la red del proveedor bloquea de forma intermitente algunas IPs de los runners →
`dial tcp 76.13.112.206:22: i/o timeout`). Como el repo es **público**, tampoco
es seguro usar un *self-hosted runner* (un PR de cualquiera ejecutaría código en
el servidor). La solución es invertir la dirección: el VPS consulta a GitHub de
forma **saliente** (siempre funciona) y se autodespliega.

## Cómo funciona

- `kingpack-deploy.timer` (systemd) dispara cada minuto.
- Ejecuta `/usr/local/bin/kingpack-auto-deploy.sh` (copia de [auto-deploy.sh](auto-deploy.sh)).
- El script compara el HEAD local contra `origin/master`. Si no cambió, sale.
- Si avanzó: preserva `frontend/.env.production` (secretos locales), hace
  `git pull --ff-only`, instala dependencias y migraciones del backend,
  rebuildea el frontend (parándolo antes para evitar el ENOENT por carrera con
  `.next`), reinicia pm2 y verifica el healthcheck del backend.
- `flock` evita que dos corridas se solapen.

GitHub Actions (`.github/workflows/deploy.yml`) quedó solo como **verificación de
build**: compila el frontend en cada push para avisar si algo no compila, pero ya
no despliega.

## Instalación en el VPS (una sola vez)

```bash
install -m 755 /var/www/KINGPACK/deploy/auto-deploy.sh /usr/local/bin/kingpack-auto-deploy.sh
install -m 644 /var/www/KINGPACK/deploy/kingpack-deploy.service /etc/systemd/system/
install -m 644 /var/www/KINGPACK/deploy/kingpack-deploy.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now kingpack-deploy.timer
```

> Si se modifica `auto-deploy.sh`, reinstalar la copia en `/usr/local/bin`
> (el timer ejecuta esa copia, no la del repo).

## Operación

```bash
systemctl status kingpack-deploy.timer      # ver que esté activo
systemctl list-timers kingpack-deploy.timer # próxima corrida
systemctl start kingpack-deploy.service     # forzar un deploy ahora
journalctl -u kingpack-deploy.service -n 50 # ver el log del último deploy
```
