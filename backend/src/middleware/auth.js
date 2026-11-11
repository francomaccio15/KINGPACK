const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET no está definido en el entorno. El servidor no puede arrancar de forma segura.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
if (JWT_SECRET.length < 32) {
  console.warn('[security] JWT_SECRET tiene menos de 32 caracteres: conviene rotarlo por uno largo y aleatorio.');
}

const { pool } = require('../config/db');
const { clientIp, registrarEvento } = require('../services/seguridad');

// El JWT dura horas: si a un usuario lo desactivan, lo borran o le cambian el
// rol, el token viejo no debe seguir valiendo. Se consulta el estado real del
// usuario (con caché corta para no pegarle a la base en cada request).
const CACHE_MS = 30 * 1000;
const cacheUsuarios = new Map(); // id → { ts, row|null }

async function estadoUsuario(id) {
  const c = cacheUsuarios.get(id);
  if (c && Date.now() - c.ts < CACHE_MS) return c.row;
  const { rows } = await pool.query(
    `SELECT u.rol, u.activo, u.sucursal_default_id, s.nombre AS sucursal_default_nombre,
            FLOOR(EXTRACT(EPOCH FROM u.tokens_validos_desde))::bigint AS tokens_desde
       FROM usuarios u
       LEFT JOIN sucursales s ON s.id = u.sucursal_default_id
      WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [id]
  );
  const row = rows[0] || null;
  cacheUsuarios.set(id, { ts: Date.now(), row });
  if (cacheUsuarios.size > 1000) cacheUsuarios.clear();
  return row;
}

/** Borra el estado cacheado (llamar al editar/desactivar un usuario). */
function invalidarUsuario(id) { cacheUsuarios.delete(String(id)); }

async function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  const token = auth.slice(7);
  try {
    req.usuario = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    // Instrumentación de cierres de sesión: registrar por qué se rechaza un token
    // que SÍ vino (expirado vs. firma inválida) con los tiempos reales, para
    // diagnosticar si la sesión se cae antes de lo esperado. Grep: [auth-401]
    try {
      const decoded = jwt.decode(token) || {};
      const now  = Math.floor(Date.now() / 1000);
      const info = {
        motivo:  err.name === 'TokenExpiredError' ? 'EXPIRADO' : 'INVALIDO',
        ruta:    `${req.method} ${(req.originalUrl || req.url || '').split('?')[0]}`,
        ip:      clientIp(req),
        usuario: decoded.email || decoded.id || null,
      };
      if (err.name === 'TokenExpiredError' && decoded.iat && decoded.exp) {
        info.vida_util_min     = Math.round((decoded.exp - decoded.iat) / 60);
        info.expirado_hace_min = Math.round((now - decoded.exp) / 60);
      }
      console.warn('[auth-401]', JSON.stringify(info));
      // Firma inválida = token fabricado o manipulado: es actividad sospechosa.
      if (err.name !== 'TokenExpiredError') {
        registrarEvento('token_invalido', { req, email: typeof decoded.email === 'string' ? decoded.email : null, error: err.name });
      }
    } catch { /* logging best-effort */ }
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  try {
    const actual = req.usuario?.id ? await estadoUsuario(String(req.usuario.id)) : null;
    // Token emitido antes del último cambio de contraseña → sesión cerrada.
    const emitido = Number(req.usuario.iat) || 0;
    const revocado = actual?.tokens_desde && emitido < Number(actual.tokens_desde);
    if (!actual || !actual.activo || revocado) {
      registrarEvento('token_usuario_inactivo', { req, email: req.usuario?.email ?? null, usuario_id: req.usuario?.id ?? null });
      return res.status(401).json({ error: 'Sesión no válida' });
    }
    // Rol y sucursal salen de la base, no del token (por si cambiaron).
    req.usuario.rol                     = actual.rol;
    req.usuario.sucursal_default_id     = actual.sucursal_default_id;
    req.usuario.sucursal_default_nombre = actual.sucursal_default_nombre ?? null;
  } catch (err) {
    return next(err);
  }
  next();
}

function requireRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.usuario.rol)) {
      registrarEvento('acceso_denegado', { req, email: req.usuario.email ?? null, usuario_id: req.usuario.id ?? null, rol: req.usuario.rol });
      return res.status(403).json({ error: 'Sin permiso para esta acción' });
    }
    next();
  };
}

/**
 * Rol "comercial" (redes + presupuestos): lista blanca de endpoints. Consulta
 * artículos/precios/stock, carga y edita clientes (sin cuenta corriente) y arma
 * presupuestos. Todo lo demás (ventas confirmadas, caja, CC, cobros) → 403.
 */
const RUTAS_COMERCIAL = [
  ['GET',  /^\/api\/(articulos|categorias|listas-precios)(\/|$)/],
  ['GET',  /^\/api\/clientes(\/cond-iva|\/[^/]+(\/compras-mensuales)?)?\/?$/],
  ['POST', /^\/api\/clientes\/?$/],
  ['PUT',  /^\/api\/clientes\/[^/]+\/?$/],
  ['GET',  /^\/api\/ventas(\/|$)/],
  ['POST', /^\/api\/ventas\/?$/], // forzado a preventa en routes/ventas.js
  // Confirma su propio presupuesto, siempre en cuenta corriente (routes/ventas.js).
  ['PATCH', /^\/api\/ventas\/[^/]+\/confirmar-preventa\/?$/],
];

function soloRutasComercial(req, res, next) {
  if (req.usuario?.rol !== 'comercial') return next();
  const path = (req.originalUrl || req.url || '').split('?')[0];
  const ok = RUTAS_COMERCIAL.some(([m, re]) => m === req.method && re.test(path));
  if (!ok) {
    registrarEvento('acceso_denegado', { req, email: req.usuario.email ?? null, usuario_id: req.usuario.id ?? null, rol: req.usuario.rol });
    return res.status(403).json({ error: 'Sin permiso para esta acción' });
  }
  next();
}

/**
 * Para cajeros devuelve siempre su sucursal del JWT (ignora query params).
 * Si el cajero no tiene sucursal asignada en el JWT devuelve un UUID imposible
 * para que ninguna query retorne datos en lugar de devolver todo.
 * Para otros roles devuelve req.query.sucursal_id (puede ser undefined).
 */
function sucursalEfectiva(req) {
  if (req.usuario?.rol === 'cajero') {
    return req.usuario.sucursal_default_id || '00000000-0000-0000-0000-000000000000';
  }
  return req.query?.sucursal_id ?? null;
}

/** Rutas de solo-admin para escritura: GET/HEAD libres (los usan otros módulos), el resto solo administrador. */
const soloAdminEscritura = (req, res, next) =>
  (req.method === 'GET' || req.method === 'HEAD') ? next() : requireRol('administrador')(req, res, next);

module.exports = { verifyToken, requireRol, soloRutasComercial, sucursalEfectiva, soloAdminEscritura, invalidarUsuario };
