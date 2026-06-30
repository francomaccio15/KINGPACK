/**
 * Módulo ARCA — Facturación Electrónica KingPack
 * ================================================
 * Punto de entrada único para todo lo relacionado con ARCA/AFIP.
 * El resto del sistema importa solo este archivo, nunca los submódulos.
 *
 * MODOS (variable AFIP_MODO en .env):
 *   demo       → Sin certificado. Usa CUIT de prueba via AfipSDK.
 *                 Requiere AFIPSDK_ACCESS_TOKEN en .env.
 *                 Ideal para demos al cliente.
 *   homo       → Certificado real de King Pack, servidor de homologación ARCA.
 *                 Requiere que el contador completó docs/ARCA_CERTIFICADO.md.
 *   produccion → Servidor productivo ARCA. Solo activar cuando se confirme el go-live.
 *
 * USO BÁSICO:
 *   const arca = require('./services/arca');
 *
 *   // Generar factura B para consumidor final
 *   const resultado = await arca.generarFactura({
 *     puntoVenta:     1,
 *     tipoComprobante: arca.TIPO_COMPROBANTE.FACTURA_B,
 *     concepto:        arca.CONCEPTO.PRODUCTOS,
 *     cliente: {
 *       tipoDoc:  arca.TIPO_DOC.SIN_IDENTIFICAR,
 *       nroDoc:   0,
 *     },
 *     items: [
 *       { descripcion: 'Bolsas x100', cantidad: 2, precioUnitario: 1000, alicuotaIva: 21 }
 *     ],
 *   });
 *   // resultado → { CAE, CAEFchVto, nroComprobante, total, qrData, modo }
 */

const config = require('./config');
const tipos  = require('./tipos');

/**
 * Genera una factura electrónica y retorna el CAE.
 *
 * @param {object} params
 * @param {number} params.puntoVenta
 * @param {number} params.tipoComprobante  — Ver TIPO_COMPROBANTE
 * @param {number} params.concepto         — Ver CONCEPTO (default: PRODUCTOS)
 * @param {{ tipoDoc: number, nroDoc: number, razonSocial?: string }} params.cliente
 * @param {{ descripcion: string, cantidad: number, precioUnitario: number, alicuotaIva: number }[]} params.items
 * @param {string} [params.fecha]  — AAAAMMDD, default: hoy
 * @returns {Promise<{ CAE, CAEFchVto, nroComprobante, total, neto, iva, qrData, modo }>}
 */
async function generarFactura(params) {
  const comprobante = _buildComprobante(params);

  let resultado;

  if (config.esDemo) {
    resultado = await _generarDemo(comprobante);
  } else {
    const wsfe = require('./wsfe');
    const ultimo = await wsfe.ultimoNroComprobante(comprobante.puntoVenta, comprobante.tipoCbte);
    comprobante.nroComprobante = ultimo + 1;
    resultado = await wsfe.solicitarCAE(comprobante);
  }

  return {
    ...resultado,
    total:           comprobante.total,
    neto:            comprobante.neto,
    iva:             comprobante.iva,
    modo:            config.modo,
    puntoVenta:      comprobante.puntoVenta,
    tipoComprobante: comprobante.tipoCbte,
    qrData: _buildQRData(resultado.CAE, resultado.CAEFchVto, comprobante),
  };
}

/**
 * Diagnóstico: prueba solo la autenticación WSAA (firma CMS + login).
 * Sirve para validar el certificado/clave contra AFIP sin emitir comprobantes.
 */
async function probarAuth() {
  if (config.esDemo) {
    return { modo: 'demo', ok: true, mensaje: 'Modo demo: no usa WSAA.' };
  }
  const wsaa = require('./wsaa');
  const { token, sign } = await wsaa.getToken();
  return {
    modo: config.modo,
    ok:   true,
    cuit: config.cuit,
    tokenPreview: token.slice(0, 24) + '…',
    signPreview:  sign.slice(0, 24) + '…',
  };
}

/**
 * Consulta el último número de comprobante autorizado.
 */
async function ultimoComprobante(puntoVenta, tipoComprobante) {
  if (config.esDemo) {
    // En modo demo simulamos un número creciente
    return Math.floor(Math.random() * 900) + 100;
  }
  const wsfe = require('./wsfe');
  return wsfe.ultimoNroComprobante(puntoVenta, tipoComprobante);
}

// ─── Demo mode ───────────────────────────────────────────────────────────────

async function _generarDemo(comprobante) {
  // Intenta usar AfipSDK si hay token configurado
  if (config.afipsdkToken) {
    return _generarConAfipSDK(comprobante);
  }
  // Fallback: simula respuesta de ARCA para demo offline
  return _generarMock(comprobante);
}

async function _generarConAfipSDK(comprobante) {
  let Afip;
  try {
    Afip = require('@afipsdk/afip.js');
  } catch {
    throw new Error(
      'AfipSDK no instalado. Ejecutar: npm install @afipsdk/afip.js\n' +
      'O configurar AFIPSDK_ACCESS_TOKEN=false para usar modo mock.'
    );
  }

  const afip = new Afip({
    CUIT:         config.cuit,
    access_token: config.afipsdkToken,
    production:   false,
  });

  const ivaList = comprobante.iva.map(i => ({
    Id:      i.id,
    BaseImp: i.baseImp,
    Importe: i.importe,
  }));

  const ultimo = await afip.ElectronicBilling.getLastVoucher(
    comprobante.puntoVenta,
    comprobante.tipoCbte
  );
  const nro = ultimo + 1;

  const data = {
    CantReg:    1,
    PtoVta:     comprobante.puntoVenta,
    CbteTipo:   comprobante.tipoCbte,
    Concepto:   comprobante.concepto,
    DocTipo:    comprobante.docTipo,
    DocNro:     comprobante.docNro,
    CbteDesde:  nro,
    CbteHasta:  nro,
    CbteFch:    comprobante.fecha,
    ImpTotal:   comprobante.total,
    ImpTotConc: comprobante.importeNoGravado || 0,
    ImpNeto:    comprobante.neto,
    ImpOpEx:    comprobante.importeExento || 0,
    ImpIVA:     comprobante.iva.reduce((s, i) => s + i.importe, 0),
    ImpTrib:    0,
    MonId:      comprobante.moneda || 'PES',
    MonCotiz:   1,
    Iva:        ivaList,
  };

  const res = await afip.ElectronicBilling.createVoucher(data);
  return {
    CAE:            res.CAE,
    CAEFchVto:      res.CAEFchVto,
    nroComprobante: nro,
    resultado:      'A',
  };
}

function _generarMock(comprobante) {
  // Simula una respuesta de ARCA para demos sin conexión.
  const cae      = String(Math.floor(Math.random() * 9e13) + 1e13);
  const hoy      = new Date();
  const vto      = new Date(hoy.getTime() + 10 * 24 * 3600 * 1000);
  const fmtDate  = d => d.toISOString().slice(0,10);

  return {
    CAE:            cae,
    CAEFchVto:      fmtDate(vto),
    nroComprobante: Math.floor(Math.random() * 900) + 100,
    resultado:      'A',
    _mock:          true,
  };
}

/**
 * Decide el tipo de comprobante y los datos del receptor según la condición de
 * IVA del cliente. EMISOR = Responsable Inscripto (King Pack):
 *   - Cliente RI (afip 1) o Monotributo (afip 6) con CUIT → Factura A (discrimina IVA).
 *   - Resto (Consumidor Final, Exento, sin CUIT) → Factura B.
 * @param {number} condIvaAfipCliente  codigo_afip del cond_iva del cliente (1,4,5,6,13)
 * @param {string} cuitCliente         CUIT del cliente (puede venir con guiones)
 */
function comprobanteParaCliente(condIvaAfipCliente, cuitCliente) {
  const cuit = cuitCliente ? String(cuitCliente).replace(/\D/g, '') : '';
  const aplicaA = (condIvaAfipCliente === 1 || condIvaAfipCliente === 6) && cuit.length === 11;
  if (aplicaA) {
    return {
      tipoComprobante: tipos.TIPO_COMPROBANTE.FACTURA_A,
      docTipo:         tipos.TIPO_DOC.CUIT,
      docNro:          cuit,
      letra:           'A',
    };
  }
  return {
    tipoComprobante: tipos.TIPO_COMPROBANTE.FACTURA_B,
    docTipo:         tipos.TIPO_DOC.SIN_IDENTIFICAR,
    docNro:          0,
    letra:           'B',
  };
}

// ─── Helpers de construcción ─────────────────────────────────────────────────

function _buildComprobante(params) {
  const {
    puntoVenta     = config.puntoVentaDefault,
    tipoComprobante,
    concepto       = tipos.CONCEPTO.PRODUCTOS,
    cliente,
    items          = [],
    fecha,
  } = params;

  if (!tipoComprobante) throw new Error('tipoComprobante es requerido');
  if (!cliente)         throw new Error('cliente es requerido');
  if (!items.length)    throw new Error('Se requiere al menos un item');

  // Cálculo de totales
  let neto  = 0;
  let ivaMap = {};

  for (const item of items) {
    const subtotal = item.precioUnitario * item.cantidad;
    neto += subtotal;
    const alicId = _alicuotaAfipId(item.alicuotaIva);
    const ivaImporte = subtotal * (item.alicuotaIva / 100);
    if (!ivaMap[alicId]) ivaMap[alicId] = { id: alicId, pct: item.alicuotaIva, baseImp: 0, importe: 0 };
    ivaMap[alicId].baseImp  += subtotal;
    ivaMap[alicId].importe  += ivaImporte;
  }

  const ivaList  = Object.values(ivaMap);
  const totalIva = ivaList.reduce((s, i) => s + i.importe, 0);
  const total    = neto + totalIva;

  const hoy = new Date();
  const fechaStr = fecha || `${hoy.getFullYear()}${String(hoy.getMonth()+1).padStart(2,'0')}${String(hoy.getDate()).padStart(2,'0')}`;

  return {
    puntoVenta,
    tipoCbte:   tipoComprobante,
    concepto,
    docTipo:    cliente.tipoDoc,
    docNro:     cliente.nroDoc,
    fecha:      fechaStr,
    neto:       +neto.toFixed(2),
    iva:        ivaList.map(i => ({ ...i, baseImp: +i.baseImp.toFixed(2), importe: +i.importe.toFixed(2) })),
    total:      +total.toFixed(2),
    moneda:     'PES',
    nroComprobante: null, // se resuelve en generarFactura()
  };
}

function _buildQRData(cae, caeVto, comprobante) {
  const data = {
    ver:  1,
    fecha: comprobante.fecha.slice(0,4) + '-' + comprobante.fecha.slice(4,6) + '-' + comprobante.fecha.slice(6,8),
    cuit: config.cuit,
    ptoVta: comprobante.puntoVenta,
    tipoCmp: comprobante.tipoCbte,
    nroCmp:  comprobante.nroComprobante,
    importe: comprobante.total,
    moneda:  comprobante.moneda || 'PES',
    ctz:     1,
    tipoDocRec: comprobante.docTipo,
    nroDocRec:  comprobante.docNro,
    tipoCodAut: 'E',
    codAut:     cae,
  };
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

function _alicuotaAfipId(pct) {
  const MAP = { 0: 3, 2.5: 9, 5: 8, 10.5: 4, 21: 5, 27: 6 };
  return MAP[pct] ?? 5;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  generarFactura,
  ultimoComprobante,
  probarAuth,
  comprobanteParaCliente,

  // Constantes re-exportadas para que los consumidores no importen tipos.js
  TIPO_COMPROBANTE:       tipos.TIPO_COMPROBANTE,
  TIPO_DOC:               tipos.TIPO_DOC,
  CONCEPTO:               tipos.CONCEPTO,
  ALICUOTA_IVA:           tipos.ALICUOTA_IVA,
  COMPROBANTE_POR_CONDICION: tipos.COMPROBANTE_POR_CONDICION,

  // Config legible para health checks y logs
  get modoActivo() { return config.modo; },
  get esDemo()     { return config.esDemo; },
  get certPath()   { return config.certPath; },
  get cuit()       { return config.cuit; },
};
