/**
 * Rutas ARCA — solo para testing y diagnóstico.
 * En producción se llamará desde el módulo de ventas, no directamente.
 *
 * GET  /api/arca/status       — Estado del módulo (modo, CUIT, cert disponible)
 * POST /api/arca/test-factura — Genera una Factura B de prueba y retorna el CAE
 */

const router = require('express').Router();
const arca   = require('../services/arca');
const fs     = require('fs');
const path   = require('path');
const { pool } = require('../config/db');

// GET /api/arca/tipos-comprobante
router.get('/tipos-comprobante', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, codigo_afip, letra, descripcion FROM tipos_comprobante ORDER BY codigo_afip`
    );
    res.json({ tipos: rows });
  } catch (err) { next(err); }
});

// GET /api/arca/status
router.get('/status', (req, res) => {
  const certPath = path.resolve(__dirname, '../../../certs/kingpack_afip.crt');
  res.json({
    modo:           arca.modoActivo,
    esDemo:         arca.esDemo,
    cuitConfigurado: arca.esDemo ? '20409378472 (demo)' : '30717926966',
    certificado:    fs.existsSync(certPath) ? 'presente' : 'pendiente — ver docs/ARCA_CERTIFICADO.md',
    mensaje: arca.esDemo
      ? 'Módulo en modo DEMO. Los CAE son reales del servidor de homologación de ARCA.'
      : 'Módulo en modo ' + arca.modoActivo.toUpperCase() + '.',
  });
});

// POST /api/arca/test-factura
// Body (opcional): { total, cliente_razon_social }
router.post('/test-factura', async (req, res, next) => {
  try {
    const total  = parseFloat(req.body?.total) || 1210;
    const nombre = req.body?.cliente_razon_social || 'Consumidor Final (Test)';

    // Factura B — Consumidor Final — Producto $1000 + 21% IVA = $1210
    const neto    = +(total / 1.21).toFixed(2);
    const ivaImp  = +(total - neto).toFixed(2);

    const resultado = await arca.generarFactura({
      puntoVenta:      1,
      tipoComprobante: arca.TIPO_COMPROBANTE.FACTURA_B,
      concepto:        arca.CONCEPTO.PRODUCTOS,
      cliente: {
        tipoDoc: arca.TIPO_DOC.SIN_IDENTIFICAR,
        nroDoc:  0,
      },
      items: [
        {
          descripcion:    `Venta de prueba — ${nombre}`,
          cantidad:       1,
          precioUnitario: neto,
          alicuotaIva:    21,
        },
      ],
    });

    res.json({
      ok:             true,
      modo:           resultado.modo,
      CAE:            resultado.CAE,
      CAEFchVto:      resultado.CAEFchVto,
      nroComprobante: resultado.nroComprobante,
      total:          resultado.total,
      qrData:         resultado.qrData,
      qrUrl:          `https://www.afip.gob.ar/fe/qr/?p=${resultado.qrData}`,
      _mock:          resultado._mock || false,
      cliente:        nombre,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
