const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const authRouter              = require('./routes/auth');
const healthRouter            = require('./routes/health');
const articulosRouter         = require('./routes/articulos');
const categoriasRouter        = require('./routes/categorias');
const listasRouter            = require('./routes/listas-precios');
const sucursalesRouter        = require('./routes/sucursales');
const clientesRouter          = require('./routes/clientes');
const arcaRouter              = require('./routes/arca');
const ventasRouter            = require('./routes/ventas');
const proveedoresRouter       = require('./routes/proveedores');
const pedidosCompraRouter     = require('./routes/pedidos-compra');
const cajaRouter              = require('./routes/caja');
const egresosRouter           = require('./routes/egresos');
const rubrosGastosRouter      = require('./routes/rubros-gastos');
const cuentasBancariasRouter  = require('./routes/cuentas-bancarias');
const cajaFuerteRouter        = require('./routes/caja-fuerte');
const cajaAdministrativaRouter = require('./routes/caja-administrativa');
const anticiposRouter         = require('./routes/anticipos-proveedores');
const dashboardRouter         = require('./routes/dashboard');
const notasRouter             = require('./routes/notas');
const notificacionesRouter    = require('./routes/notificaciones');
const notasCreditoRouter      = require('./routes/notas-credito');
const devolucionesRouter      = require('./routes/devoluciones');
const usuariosRouter          = require('./routes/usuarios');
const empleadosRouter         = require('./routes/empleados');
const traspasosRouter         = require('./routes/traspasos');
const reportesRouter          = require('./routes/reportes');
const flujoFondosRouter       = require('./routes/flujo-fondos');
const chequesRouter           = require('./routes/cheques');
const impuestosRouter         = require('./routes/impuestos');
const conciliacionRouter      = require('./routes/conciliacion');
const pagoClientesRouter      = require('./routes/pago-clientes');
const pagosProveedorRouter    = require('./routes/pagos-proveedor');
const licitacionesRouter      = require('./routes/licitaciones');
const transportesRouter       = require('./routes/transportes');
const { verifyToken, soloRutasComercial, requireRol, soloAdminEscritura } = require('./middleware/auth');
const { registrarEvento } = require('./services/seguridad');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

// Confiar en el proxy inverso (nginx) para que express-rate-limit funcione correctamente
app.set('trust proxy', 1);

if (!process.env.FRONTEND_URL) {
  console.error('[FATAL] FRONTEND_URL no está definido en el entorno. El servidor no puede arrancar de forma segura.');
  process.exit(1);
}
app.disable('x-powered-by');
app.use(helmet({
  // La API solo devuelve JSON: CSP mínimo y sin upgrade (HTTPS lo fuerzan
  // Cloudflare y nginx; no redirigir desde la app para no generar bucles).
  contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  frameguard: { action: 'deny' },
}));

// ─── CORS y CSRF ─────────────────────────────────────────────────────────────
// Orígenes permitidos: FRONTEND_URL (puede ser una lista separada por comas).
// El frontend en producción llama a la API por el mismo dominio (/api en nginx).
const ORIGENES = new Set(
  String(process.env.FRONTEND_URL).split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean)
);
function origenPermitido(req, origin) {
  if (ORIGENES.has(origin)) return true;
  // Mismo origen que el host que atiende (kingpack.macciotec.com → /api).
  try { return new URL(origin).host === (req.headers['x-forwarded-host'] || req.headers.host); } catch { return false; }
}
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || origenPermitido(req, origin)) return next();
  // Preflight de otro sitio o mutación con Origin ajeno → rechazo.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    registrarEvento('origen_rechazado', { req, origin: String(origin).slice(0, 200) });
    return res.status(403).json({ error: 'Origen no permitido' });
  }
  next();
});
app.use(cors({
  // Solo se devuelven cabeceras CORS a los orígenes de la lista; al resto, nada.
  origin: (origin, cb) => cb(null, origin && ORIGENES.has(origin) ? origin : false),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));
app.use(express.json({ limit: '1mb' }));

// Rutas públicas (sin JWT)
app.use('/api/health',     healthRouter);
app.use('/api/auth',       authRouter);
app.use('/api/sucursales', sucursalesRouter); // necesario para el layout server-side

// Todas las rutas siguientes requieren JWT válido
app.use(verifyToken);
app.use(soloRutasComercial);

app.use('/api/articulos',             articulosRouter);
app.use('/api/categorias',            categoriasRouter);
app.use('/api/listas-precios',        soloAdminEscritura, listasRouter);
app.use('/api/clientes',              clientesRouter);
app.use('/api/arca',                  arcaRouter);
app.use('/api/ventas',                ventasRouter);
app.use('/api/proveedores',           proveedoresRouter);
app.use('/api/pedidos-compra',        pedidosCompraRouter);
app.use('/api/caja',                  cajaRouter);
app.use('/api/egresos',               egresosRouter);
app.use('/api/rubros-gastos',         soloAdminEscritura, rubrosGastosRouter);
app.use('/api/cuentas-bancarias',     soloAdminEscritura, cuentasBancariasRouter);
app.use('/api/caja-fuerte',           cajaFuerteRouter);
app.use('/api/caja-administrativa',   cajaAdministrativaRouter);
app.use('/api/anticipos-proveedores', requireRol('administrador'), anticiposRouter);
app.use('/api/dashboard',             dashboardRouter);
app.use('/api/notas',                 notasRouter);
app.use('/api/notificaciones',        notificacionesRouter);
app.use('/api/notas-credito',         notasCreditoRouter);
app.use('/api/devoluciones',          devolucionesRouter);
app.use('/api/usuarios',              usuariosRouter);
app.use('/api/empleados',             empleadosRouter);
app.use('/api/traspasos',             traspasosRouter);
app.use('/api/reportes',              reportesRouter);
app.use('/api/flujo-fondos',          flujoFondosRouter);
app.use('/api/cheques',               chequesRouter);
app.use('/api/impuestos',             impuestosRouter);
app.use('/api/conciliacion',          conciliacionRouter);
app.use('/api/pago-clientes',         requireRol('administrador'), pagoClientesRouter);
app.use('/api/pagos-proveedor',       pagosProveedorRouter);
app.use('/api/licitaciones',          licitacionesRouter);
app.use('/api/transportes',           requireRol('administrador'), transportesRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

app.use((err, req, res, _next) => {
  // JSON mal formado o body demasiado grande: error del cliente, no del server.
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err.type === 'entity.too.large')    return res.status(413).json({ error: 'Pedido demasiado grande' });
  console.error('[API] Error:', err);
  // Nunca se devuelve el detalle ni el stack al cliente.
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`[API] KingPack backend listening on :${PORT} (env=${process.env.NODE_ENV || 'development'})`);
});
