const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const healthRouter         = require('./routes/health');
const articulosRouter      = require('./routes/articulos');
const categoriasRouter     = require('./routes/categorias');
const listasRouter         = require('./routes/listas-precios');
const sucursalesRouter     = require('./routes/sucursales');
const clientesRouter       = require('./routes/clientes');
const arcaRouter           = require('./routes/arca');
const ventasRouter         = require('./routes/ventas');
const proveedoresRouter    = require('./routes/proveedores');
const pedidosCompraRouter  = require('./routes/pedidos-compra');
const cajaRouter           = require('./routes/caja');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/health',         healthRouter);
app.use('/api/articulos',      articulosRouter);
app.use('/api/categorias',     categoriasRouter);
app.use('/api/listas-precios', listasRouter);
app.use('/api/sucursales',     sucursalesRouter);
app.use('/api/clientes',       clientesRouter);
app.use('/api/arca',           arcaRouter);
app.use('/api/ventas',          ventasRouter);
app.use('/api/proveedores',    proveedoresRouter);
app.use('/api/pedidos-compra', pedidosCompraRouter);
app.use('/api/caja',          cajaRouter);

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
