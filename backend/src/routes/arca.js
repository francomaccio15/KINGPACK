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
  const certPath = arca.certPath;
  res.json({
    modo:           arca.modoActivo,
    esDemo:         arca.esDemo,
    cuitConfigurado: arca.esDemo ? '20409378472 (demo)' : String(arca.cuit),
    certPath,
    certificado:    fs.existsSync(certPath) ? 'presente' : 'pendiente — ver docs/ARCA_CERTIFICADO.md',
    mensaje: arca.esDemo
      ? 'Módulo en modo DEMO. Los CAE son reales del servidor de homologación de ARCA.'
      : 'Módulo en modo ' + arca.modoActivo.toUpperCase() + '.',
  });
});

// GET /api/arca/test-auth — diagnóstico: prueba solo el login WSAA (firma CMS).
// No emite comprobantes. Sirve para validar el certificado contra AFIP.
router.get('/test-auth', async (req, res) => {
  try {
    const r = await arca.probarAuth();
    res.json(r);
  } catch (err) {
    res.status(502).json({ ok: false, modo: arca.modoActivo, error: err.message });
  }
});

// POST /api/arca/test-factura — diagnóstico de emisión.
// Body (opcional): { total, cliente_razon_social, cond_iva_afip, cuit }
//   cond_iva_afip + cuit permiten probar Factura A (RI/Monotributo con CUIT).
//   Sin esos datos → Factura B a Consumidor Final.
router.post('/test-factura', async (req, res, next) => {
  try {
    const total  = parseFloat(req.body?.total) || 1210;
    const nombre = req.body?.cliente_razon_social || 'Consumidor Final (Test)';
    const condIvaAfip = req.body?.cond_iva_afip != null ? parseInt(req.body.cond_iva_afip, 10) : 5;
    const cuit        = req.body?.cuit || null;

    const neto = +(total / 1.21).toFixed(2);
    const comp = arca.comprobanteParaCliente(condIvaAfip, cuit);

    const resultado = await arca.generarFactura({
      // puntoVenta omitido → usa AFIP_PUNTO_VENTA
      tipoComprobante: comp.tipoComprobante,
      concepto:        arca.CONCEPTO.PRODUCTOS,
      cliente: { tipoDoc: comp.docTipo, nroDoc: comp.docNro },
      items: [
        { descripcion: `Venta de prueba — ${nombre}`, cantidad: 1, precioUnitario: neto, alicuotaIva: 21 },
      ],
    });

    res.json({
      ok:             true,
      modo:           resultado.modo,
      letra:          comp.letra,
      puntoVenta:     resultado.puntoVenta,
      CAE:            resultado.CAE,
      CAEFchVto:      resultado.CAEFchVto,
      nroComprobante: resultado.nroComprobante,
      total:          resultado.total,
      qrUrl:          `https://www.afip.gob.ar/fe/qr/?p=${resultado.qrData}`,
      _mock:          resultado._mock || false,
      cliente:        nombre,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
