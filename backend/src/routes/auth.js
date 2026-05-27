const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET     = process.env.JWT_SECRET     || 'changeme-set-in-env';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.' },
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const { rows } = await pool.query(
      `SELECT id, email, password_hash, nombre, rol, sucursal_default_id, activo
         FROM usuarios
        WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase().trim()]
    );

    const usuario = rows[0];

    // Tiempo constante para no filtrar si el email existe
    const hashFake = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';
    const valid = usuario
      ? await bcrypt.compare(password, usuario.password_hash)
      : await bcrypt.compare(password, hashFake).then(() => false);

    if (!valid || !usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const payload = {
      id:                   usuario.id,
      email:                usuario.email,
      nombre:               usuario.nombre,
      rol:                  usuario.rol,
      sucursal_default_id:  usuario.sucursal_default_id,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token, usuario: payload });
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
