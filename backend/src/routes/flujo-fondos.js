const express = require('express');
const { requireRol } = require('../middleware/auth');
const { normalizarParams, calcularFlujo } = require('../services/flujo-fondos');
const { generarExcel } = require('../services/flujo-fondos-excel');

const router = express.Router();

// Incluye retiros de los dueños y saldos de todas las cuentas: solo administración.
router.use(requireRol('administrador'));

// GET /api/flujo-fondos
// ?desde=AAAA-MM (default: primer mes con ventas) ?hasta=AAAA-MM (default: mes actual)
// ?inflacion=0.02 ?crecimiento=0  (fracciones mensuales, para la proyección)
router.get('/', async (req, res, next) => {
  try {
    const params = await normalizarParams(req.query);
    if (params.error) return res.status(400).json({ error: params.error });
    res.json(await calcularFlujo(params));
  } catch (err) {
    next(err);
  }
});

// GET /api/flujo-fondos/excel — mismos parámetros, devuelve la planilla .xlsx
router.get('/excel', async (req, res, next) => {
  try {
    const params = await normalizarParams(req.query);
    if (params.error) return res.status(400).json({ error: params.error });
    const data = await calcularFlujo(params);
    const buffer = await generarExcel(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="flujo-de-fondos-${params.desde}_${params.hasta}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
