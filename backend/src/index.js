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
const anticiposRouter         = require('./routes/anticipos-proveedores');
const dashboardRouter         = require('./routes/dashboard');
const notasRouter             = require('./routes/notas');
const notificacionesRouter    = require('./routes/notificaciones');
const notasCreditoRouter      = require('./routes/notas-credito');
const usuariosRouter          = require('./routes/usuarios');
const empleadosRouter         = require('./routes/empleados');
const traspasosRouter         = require('./routes/traspasos');
const reportesRouter          = require('./routes/reportes');
const { verifyToken }         = require('./middleware/auth');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

// Confiar en el proxy inverso (nginx) para que express-rate-limit funcione correctamente
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json({ limit: '1mb' }));

// Rutas públicas (sin JWT)
app.use('/api/health',     healthRouter);
app.use('/api/auth',       authRouter);
app.use('/api/sucursales', sucursalesRouter); // necesario para el layout server-side

// Todas las rutas siguientes requieren JWT válido
app.use(verifyToken);

app.use('/api/articulos',             articulosRouter);
app.use('/api/categorias',            categoriasRouter);
app.use('/api/listas-precios',        listasRouter);
app.use('/api/clientes',              clientesRouter);
app.use('/api/arca',                  arcaRouter);
app.use('/api/ventas',                ventasRouter);
app.use('/api/proveedores',           proveedoresRouter);
app.use('/api/pedidos-compra',        pedidosCompraRouter);
app.use('/api/caja',                  cajaRouter);
app.use('/api/egresos',               egresosRouter);
app.use('/api/rubros-gastos',         rubrosGastosRouter);
app.use('/api/cuentas-bancarias',     cuentasBancariasRouter);
app.use('/api/anticipos-proveedores', anticiposRouter);
app.use('/api/dashboard',             dashboardRouter);
app.use('/api/notas',                 notasRouter);
app.use('/api/notificaciones',        notificacionesRouter);
app.use('/api/notas-credito',         notasCreditoRouter);
app.use('/api/usuarios',              usuariosRouter);
app.use('/api/empleados',             empleadosRouter);
app.use('/api/traspasos',             traspasosRouter);
app.use('/api/reportes',              reportesRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

app.use((err, req, res, _next) => {
  console.error('[API] Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`[API] KingPack backend listening on :${PORT} (env=${process.env.NODE_ENV || 'development'})`);
});
