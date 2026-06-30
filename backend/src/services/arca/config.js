/**
 * Configuración del módulo ARCA (ex-AFIP).
 * Controlada íntegramente por variables de entorno — sin valores hardcodeados.
 *
 * Modos de operación:
 *   DEMO     → AFIP_MODO=demo   — Usa CUIT de prueba de AfipSDK, sin certificado propio.
 *               Ideal para mostrar el flujo al cliente antes de tener el certificado.
 *   HOMO     → AFIP_MODO=homo   — Usa el certificado real de King Pack contra el servidor
 *               de homologación de ARCA. Requiere que el certificado esté en el servidor.
 *   PRODUCCION → AFIP_MODO=produccion — Servidor productivo de ARCA. Solo activar cuando
 *               el contador completó la guía docs/ARCA_CERTIFICADO.md.
 */

const path = require('path');

const MODO = (process.env.AFIP_MODO || 'demo').toLowerCase();

const ENDPOINTS = {
  homo: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  },
  produccion: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  },
};

// CUIT de demo provisto por AfipSDK para testing sin certificado propio
const CUIT_DEMO = 20409378472;

const CERTS_DIR = path.resolve(__dirname, '../../../../certs');

const config = {
  modo: MODO,
  esDemo:       MODO === 'demo',
  esHomo:       MODO === 'homo',
  esProduccion: MODO === 'produccion',

  cuit: MODO === 'demo'
    ? CUIT_DEMO
    : parseInt(process.env.AFIP_CUIT || '30717926966', 10),

  certPath: process.env.AFIP_CERT_PATH || path.join(CERTS_DIR, 'kingpack_afip.crt'),
  keyPath:  process.env.AFIP_KEY_PATH  || path.join(CERTS_DIR, 'kingpack_afip.key'),

  // Access token de AfipSDK (solo para modo demo)
  afipsdkToken: process.env.AFIPSDK_ACCESS_TOKEN || '',

  endpoints: MODO === 'produccion' ? ENDPOINTS.produccion : ENDPOINTS.homo,

  // Punto de venta por defecto (fallback si la sucursal no está en el mapa)
  puntoVentaDefault: parseInt(process.env.AFIP_PUNTO_VENTA || '1', 10),

  // Mapa punto de venta por sucursal. Env AFIP_PV_MAP = JSON con nombre→PV.
  // Ej. producción: AFIP_PV_MAP={"Laprida":4,"Huaico":6}
  pvPorSucursal: (() => {
    try { return JSON.parse(process.env.AFIP_PV_MAP || '{}'); } catch { return {}; }
  })(),

  // Duración máxima del token de autenticación (ARCA emite tokens de 12hs)
  tokenTtlMs: 11 * 60 * 60 * 1000,
};

// Devuelve el punto de venta correspondiente a una sucursal (por nombre),
// o el default si no está mapeada.
config.puntoVentaPara = function (sucursalNombre) {
  const pv = sucursalNombre != null ? config.pvPorSucursal[sucursalNombre] : undefined;
  return pv != null ? parseInt(pv, 10) : config.puntoVentaDefault;
};

module.exports = config;
