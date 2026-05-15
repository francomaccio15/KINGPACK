/**
 * Constantes del sistema de facturación electrónica ARCA.
 * Fuente: Manual de Desarrollador WSFE v1 — AFIP/ARCA.
 */

const TIPO_COMPROBANTE = {
  FACTURA_A:       1,
  FACTURA_B:       6,
  FACTURA_C:      11,
  NOTA_DEBITO_A:   2,
  NOTA_DEBITO_B:   7,
  NOTA_CREDITO_A:  3,
  NOTA_CREDITO_B:  8,
  TICKET:         39,
};

const TIPO_DOC = {
  CUIT:  80,
  CUIL:  86,
  CDI:   87,
  DNI:   96,
  SIN_IDENTIFICAR: 99,  // Consumidor final
};

const CONCEPTO = {
  PRODUCTOS:         1,
  SERVICIOS:         2,
  PRODUCTOS_Y_SERVICIOS: 3,
};

const ALICUOTA_IVA = {
  NO_GRAVADO:  3,
  EXENTO:      4,
  IVA_10_5:    4, // id AFIP = 4 → 10.5%
  IVA_21:      5, // id AFIP = 5 → 21%
  IVA_27:      6, // id AFIP = 6 → 27%
  IVA_5:       8, // id AFIP = 8 → 5%
  IVA_2_5:     9, // id AFIP = 9 → 2.5%
};

const MONEDA = {
  PESOS:   'PES',
  DOLARES: 'DOL',
  EURO:    '060',
};

// Tipos de comprobante que corresponden a cada condición IVA del emisor
// Ayuda para decidir qué tipo emitir según el cliente
const COMPROBANTE_POR_CONDICION = {
  responsable_inscripto:   TIPO_COMPROBANTE.FACTURA_A,
  consumidor_final:        TIPO_COMPROBANTE.FACTURA_B,
  exento:                  TIPO_COMPROBANTE.FACTURA_B,
  monotributo:             TIPO_COMPROBANTE.FACTURA_C,
};

module.exports = {
  TIPO_COMPROBANTE,
  TIPO_DOC,
  CONCEPTO,
  ALICUOTA_IVA,
  MONEDA,
  COMPROBANTE_POR_CONDICION,
};
