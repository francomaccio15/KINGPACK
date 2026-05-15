/**
 * WSFE — Web Service de Facturación Electrónica v1 de ARCA.
 * Implementa FECAESolicitar y FECompUltimoAutorizado sobre el endpoint SOAP.
 * Funciona tanto en modo homo como en producción; el modo demo lo maneja index.js.
 */

const https = require('https');
const config = require('./config');
const wsaa   = require('./wsaa');

/**
 * Solicita un CAE para un comprobante nuevo.
 * @param {object} comprobante — Estructura del comprobante (ver index.js para el formato).
 * @returns {{ CAE, CAEFchVto, nroComprobante, resultado }}
 */
async function solicitarCAE(comprobante) {
  const { token, sign } = await wsaa.getToken();
  const xml = _buildFECAESolicitar(comprobante, token, sign);
  const respXml = await _soapPost('FECAESolicitar', xml);
  return _parsearRespuestaCAE(respXml);
}

/**
 * Obtiene el último número de comprobante autorizado para un PV y tipo.
 */
async function ultimoNroComprobante(puntoVenta, tipoComprobante) {
  const { token, sign } = await wsaa.getToken();
  const xml = _buildFECompUltimoAutorizado(puntoVenta, tipoComprobante, token, sign);
  const respXml = await _soapPost('FECompUltimoAutorizado', xml);

  const match = respXml.match(/<CbteNro>(\d+)<\/CbteNro>/);
  if (!match) throw new Error(`WSFE: no se pudo leer último comprobante.\n${respXml.slice(0, 400)}`);
  return parseInt(match[1], 10);
}

// ─── Builders SOAP ───────────────────────────────────────────────────────────

function _buildFECAESolicitar(c, token, sign) {
  const iva = (c.iva || [])
    .map(i => `<AlicIva><Id>${i.id}</Id><BaseImp>${i.baseImp.toFixed(2)}</BaseImp><Importe>${i.importe.toFixed(2)}</Importe></AlicIva>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${config.cuit}</ar:Cuit>
      </ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${c.puntoVenta}</ar:PtoVta>
          <ar:CbteTipo>${c.tipoCbte}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>${c.concepto}</ar:Concepto>
            <ar:DocTipo>${c.docTipo}</ar:DocTipo>
            <ar:DocNro>${c.docNro}</ar:DocNro>
            <ar:CbteDesde>${c.nroComprobante}</ar:CbteDesde>
            <ar:CbteHasta>${c.nroComprobante}</ar:CbteHasta>
            <ar:CbteFch>${c.fecha}</ar:CbteFch>
            <ar:ImpTotal>${c.total.toFixed(2)}</ar:ImpTotal>
            <ar:ImpTotConc>${(c.importeNoGravado || 0).toFixed(2)}</ar:ImpTotConc>
            <ar:ImpNeto>${c.neto.toFixed(2)}</ar:ImpNeto>
            <ar:ImpOpEx>${(c.importeExento || 0).toFixed(2)}</ar:ImpOpEx>
            <ar:ImpIVA>${c.iva.reduce((s, i) => s + i.importe, 0).toFixed(2)}</ar:ImpIVA>
            <ar:ImpTrib>0.00</ar:ImpTrib>
            <ar:MonId>${c.moneda || 'PES'}</ar:MonId>
            <ar:MonCotiz>${c.cotizacion || 1}</ar:MonCotiz>
            <ar:Iva>${iva}</ar:Iva>
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function _buildFECompUltimoAutorizado(pv, tipo, token, sign) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECompUltimoAutorizado>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${config.cuit}</ar:Cuit>
      </ar:Auth>
      <ar:PtoVta>${pv}</ar:PtoVta>
      <ar:CbteTipo>${tipo}</ar:CbteTipo>
    </ar:FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function _parsearRespuestaCAE(xml) {
  const err = xml.match(/<Err>[\s\S]*?<Msg>([\s\S]+?)<\/Msg>[\s\S]*?<\/Err>/);
  if (err) throw new Error(`ARCA rechazó el comprobante: ${err[1].trim()}`);

  const cae    = xml.match(/<CAE>(\d+)<\/CAE>/);
  const vto    = xml.match(/<CAEFchVto>(\d{8})<\/CAEFchVto>/);
  const nro    = xml.match(/<CbteDesde>(\d+)<\/CbteDesde>/);
  const result = xml.match(/<Resultado>([AB])<\/Resultado>/);

  if (!cae) throw new Error(`ARCA no devolvió CAE. Respuesta:\n${xml.slice(0, 600)}`);

  return {
    CAE:            cae[1],
    CAEFchVto:      vto ? `${vto[1].slice(0,4)}-${vto[1].slice(4,6)}-${vto[1].slice(6,8)}` : null,
    nroComprobante: nro ? parseInt(nro[1], 10) : null,
    resultado:      result ? result[1] : 'A',
  };
}

function _soapPost(action, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(config.endpoints.wsfe);
    const options = {
      hostname: url.hostname,
      path:     url.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'text/xml; charset=utf-8',
        'SOAPAction':     `"http://ar.gov.afip.dif.FEV1/${action}"`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error(`WSFE timeout en ${action}`)));
    req.write(body);
    req.end();
  });
}

module.exports = { solicitarCAE, ultimoNroComprobante };
