const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const healthRouter     = require('./routes/health');
const articulosRouter  = require('./routes/articulos');
const categoriasRouter = require('./routes/categorias');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/health',     healthRouter);
app.use('/api/articulos',  articulosRouter);
app.use('/api/categorias', categoriasRouter);

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
