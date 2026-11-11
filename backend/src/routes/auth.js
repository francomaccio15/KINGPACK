const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/db');
const { verifyToken } = require('../middleware/auth');
const { clientIp, registrarEvento } = require('../services/seguridad');

const router = express.Router();

const JWT_SECRET     = process.env.JWT_SECRET;     // falta → process.exit(1) en middleware/auth.js
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const MSG_BLOQUEO = 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.';

// Límite por IP real (CF-Connecting-IP / X-Real-IP, no el X-Forwarded-For que
// puede inventar el atacante). Frena el barrido de muchas cuentas desde un lugar.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => clientIp(req) || 'sin-ip',
  validate: false,
  handler: (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim().slice(0, 255) : null;
    registrarEvento('login_limite_ip', { req, email });
    res.status(429).json({ error: MSG_BLOQUEO });
  },
});

// Límite por CUENTA: 5 contraseñas erradas en 15 minutos bloquean esa cuenta
// 15 minutos, venga de la IP que venga (un ataque distribuido no lo esquiva).
// En memoria: el backend corre en una sola instancia (pm2 fork).
const MAX_FALLOS   = 5;
const VENTANA_MS   = 15 * 60 * 1000;
const fallosCuenta = new Map(); // email → { count, desde, bloqueadoHasta }

function estadoCuenta(email) {
  const now = Date.now();
  const e = fallosCuenta.get(email);
  if (!e) return null;
  if (e.bloqueadoHasta && e.bloqueadoHasta > now) return e;
  if (now - e.desde > VENTANA_MS || e.bloqueadoHasta) { fallosCuenta.delete(email); return null; }
  return e;
}

function registrarFallo(email) {
  const now = Date.now();
  const e = estadoCuenta(email) || { count: 0, desde: now, bloqueadoHasta: 0 };
  e.count += 1;
  if (e.count >= MAX_FALLOS) e.bloqueadoHasta = now + VENTANA_MS;
  fallosCuenta.set(email, e);
  return e;
}

// Limpieza periódica para que el mapa no crezca sin límite.
setInterval(() => {
  for (const k of fallosCuenta.keys()) estadoCuenta(k);
}, 5 * 60 * 1000).unref();

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email: emailRaw, password } = req.body || {};
    if (typeof emailRaw !== 'string' || typeof password !== 'string' || !emailRaw.trim() || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    if (emailRaw.length > 255 || password.length > 200) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }
    const email = emailRaw.toLowerCase().trim();

    if (estadoCuenta(email)?.bloqueadoHasta > Date.now()) {
      registrarEvento('login_cuenta_bloqueada', { req, email });
      return res.status(429).json({ error: MSG_BLOQUEO });
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.password_hash, u.nombre, u.rol,
              u.sucursal_default_id, u.activo,
              s.nombre AS sucursal_default_nombre
         FROM usuarios u
         LEFT JOIN sucursales s ON s.id = u.sucursal_default_id
        WHERE u.email = $1 AND u.deleted_at IS NULL`,
      [email]
    );

    const usuario = rows[0];

    // Tiempo constante para no filtrar si el email existe
    const hashFake = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';
    const valid = usuario
      ? await bcrypt.compare(password, usuario.password_hash)
      : await bcrypt.compare(password, hashFake).then(() => false);

    if (!valid || !usuario || !usuario.activo) {
      const e = registrarFallo(email);
      const bloqueada = e.bloqueadoHasta > Date.now();
      registrarEvento(bloqueada ? 'login_bloqueo_cuenta' : 'login_fallido', {
        req, email,
        motivo: !usuario ? 'email_inexistente' : !valid ? 'password_incorrecta' : 'usuario_inactivo',
        intentos: e.count,
      });
      if (bloqueada) return res.status(429).json({ error: MSG_BLOQUEO });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    fallosCuenta.delete(email);

    const payload = {
      id:                   usuario.id,
      email:                usuario.email,
      nombre:               usuario.nombre,
      rol:                  usuario.rol,
      sucursal_default_id:  usuario.sucursal_default_id,
      // Nombre de la sucursal: lo usa el control de acceso para reglas que
      // dependen de la sucursal (ej: solo el cajero de Laprida ve Licitaciones).
      sucursal_default_nombre: usuario.sucursal_default_nombre ?? null,
    };

    // Sucursal con la que arranca la sesión (setea la cookie kp_sucursal_id):
    //  - si el usuario tiene sucursal por defecto, esa
    //  - si es administrador sin sucursal fija, Laprida como principal
    let sucursal_inicial_id = usuario.sucursal_default_id || null;
    if (!sucursal_inicial_id && usuario.rol === 'administrador') {
      const { rows: suc } = await pool.query(
        `SELECT id FROM sucursales WHERE nombre ILIKE 'laprida' LIMIT 1`
      );
      sucursal_inicial_id = suc[0]?.id || null;
    }

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token, usuario: payload, sucursal_inicial_id });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  res.json({ usuario: req.usuario });
});

// POST /api/auth/logout  (stateless — el cliente descarta el token)
router.post('/logout', (_req, res) => {
  res.json({ ok: true });
});

module.exports = router;
