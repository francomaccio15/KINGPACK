/**
 * WSFE — Web Service de Facturación Electrónica v1 de ARCA.
 * Implementa FECAESolicitar y FECompUltimoAutorizado sobre el endpoint SOAP.
 * Funciona tanto en modo homo como en producción; el modo demo lo maneja index.js.
 */

const https = require('https');
const config = require('./config');
const wsaa   = require('./wsaa');

const TIMEOUT_MS = parseInt(process.env.AFIP_TIMEOUT_MS || '60000', 10);

/**
 * Solicita un CAE para un comprobante nuevo.
 * @param {object} comprobante — Estructura del comprobante (ver index.js para el formato).
 * @returns {{ CAE, CAEFchVto, nroComprobante, resultado }}
 */
async function solicitarCAE(comprobante) {
  const { token, sign } = await wsaa.getToken();
  const xml = _buildFECAESolicitar(comprobante, token, sign);

  let respXml;
  try {
    respXml = await _soapPost('FECAESolicitar', xml);
  } catch (err) {
    // Un timeout o corte de red acá es AMBIGUO: ARCA pudo haber autorizado el
    // comprobante y perderse la respuesta. Reintentar emitiría un duplicado, así
    // que preguntamos si el comprobante quedó emitido y, si sí, lo recuperamos.
    // (2026-08-11: así se perdió la 0006-00000207, emitida en ARCA e inexistente
    // en KingPack, que devolvió 500 al cajero.)
    const recuperado = await _recuperarTrasFalla(comprobante);
    if (recuperado) return recuperado;
    throw err;
  }

  return _parsearRespuestaCAE(respXml);
}

/**
 * Tras una falla ambigua de FECAESolicitar, consulta a ARCA si el comprobante
 * que intentábamos emitir quedó realmente autorizado. Devuelve el mismo shape
 * que _parsearRespuestaCAE, o null si no se emitió (y entonces el error es real).
 */
async function _recuperarTrasFalla(comprobante) {
  const { puntoVenta, tipoCbte, nroComprobante } = comprobante;
  try {
    const ultimo = await ultimoNroComprobante(puntoVenta, tipoCbte);
    if (ultimo < nroComprobante) {
      console.warn(
        `[arca] falla de red en PV ${puntoVenta} tipo ${tipoCbte} nro ${nroComprobante}: ` +
        `ARCA sigue en ${ultimo}, el comprobante no se emitió. Se puede reintentar.`
      );
      return null;
    }

    const cbte = await consultarComprobante(puntoVenta, tipoCbte, nroComprobante);
    if (!cbte || !cbte.CAE) {
      console.warn(`[arca] ${puntoVenta}-${nroComprobante} figura emitido pero sin CAE consultable`);
      return null;
    }

    console.warn(
      `[arca] CAE recuperado tras falla de red: PV ${puntoVenta} tipo ${tipoCbte} ` +
      `nro ${nroComprobante} CAE ${cbte.CAE}`
    );
    return cbte;
  } catch (e) {
    // Si la recuperación también falla, dejamos que el error original se propague.
    console.error(`[arca] no se pudo verificar si ${puntoVenta}-${nroComprobante} se emitió: ${e.message}`);
    return null;
  }
}

/**
 * Consulta un comprobante ya emitido (FECompConsultar).
 * @returns {{ CAE, CAEFchVto, nroComprobante, resultado, total, fecha, docTipo, docNro } | null}
 */
async function consultarComprobante(puntoVenta, tipoComprobante, nro) {
  const { token, sign } = await wsaa.getToken();
  const xml = _buildFECompConsultar(puntoVenta, tipoComprobante, nro, token, sign);
  const respXml = await _soapPost('FECompConsultar', xml);

  const fault = respXml.match(/<faultstring>([\s\S]+?)<\/faultstring>/i);
  if (fault) throw new Error(`WSFE error: ${fault[1].trim()}`);

  const get = campo => (respXml.match(new RegExp(`<${campo}>([^<]*)</${campo}>`)) || [])[1];

  const cae = get('CodAutorizacion');
  if (!cae) return null;   // no existe / no autorizado

  const vto = get('FchVto');
  return {
    CAE:            cae,
    CAEFchVto:      vto ? `${vto.slice(0,4)}-${vto.slice(4,6)}-${vto.slice(6,8)}` : null,
    nroComprobante: parseInt(get('CbteDesde'), 10),
    resultado:      get('Resultado') || 'A',
    total:          parseFloat(get('ImpTotal')),
    fecha:          get('CbteFch'),
    docTipo:        parseInt(get('DocTipo'), 10),
    docNro:         get('DocNro'),
    recuperado:     true,
  };
}

/**
 * Obtiene el último número de comprobante autorizado para un PV y tipo.
 */
async function ultimoNroComprobante(puntoVenta, tipoComprobante) {
  const { token, sign } = await wsaa.getToken();
  const xml = _buildFECompUltimoAutorizado(puntoVenta, tipoComprobante, token, sign);
  const respXml = await _soapPost('FECompUltimoAutorizado', xml);

  _assertSinFaultNiError(respXml);
  const match = respXml.match(/<CbteNro>(\d+)<\/CbteNro>/);
  if (!match) throw new Error(`WSFE: no se pudo leer último comprobante.\n${respXml.slice(0, 400)}`);
  return parseInt(match[1], 10);
}

// Detecta faults SOAP y errores de AFIP (Errors > Err > Code/Msg) y lanza.
function _assertSinFaultNiError(xml) {
  const fault = xml.match(/<faultstring>([\s\S]+?)<\/faultstring>/i);
  if (fault) throw new Error(`WSFE error: ${fault[1].trim()}`);
  const errs = [...xml.matchAll(/<Err>[\s\S]*?(?:<Code>(\d+)<\/Code>)?[\s\S]*?<Msg>([\s\S]+?)<\/Msg>[\s\S]*?<\/Err>/g)]
    .map(m => `${m[1] ? '[' + m[1] + '] ' : ''}${m[2].trim()}`);
  if (errs.length) throw new Error(`ARCA rechazó la solicitud: ${errs.join(' | ')}`);
}

// ─── Builders SOAP ───────────────────────────────────────────────────────────

function _buildFECAESolicitar(c, token, sign) {
  const iva = (c.iva || [])
    .map(i => `<ar:AlicIva><ar:Id>${i.id}</ar:Id><ar:BaseImp>${i.baseImp.toFixed(2)}</ar:BaseImp><ar:Importe>${i.importe.toFixed(2)}</ar:Importe></ar:AlicIva>`)
    .join('');

  // Obligatorio para Notas de Débito/Crédito (AFIP error 10197): referencian el
  // comprobante original (Tipo/PtoVta/Nro AFIP, no el id interno de KingPack).
  const cbtesAsoc = (c.cbtesAsoc || [])
    .map(a => `<ar:CbteAsoc><ar:Tipo>${a.tipo}</ar:Tipo><ar:PtoVta>${a.ptoVta}</ar:PtoVta><ar:Nro>${a.nro}</ar:Nro></ar:CbteAsoc>`)
    .join('');
  const cbtesAsocXml = cbtesAsoc ? `<ar:CbtesAsoc>${cbtesAsoc}</ar:CbtesAsoc>` : '';

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
            <ar:CondicionIVAReceptorId>${c.condicionIvaReceptor}</ar:CondicionIVAReceptorId>
            ${cbtesAsocXml}
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

function _buildFECompConsultar(pv, tipo, nro, token, sign) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ar:FECompConsultar>
      <ar:Auth>
        <ar:Token>${token}</ar:Token>
        <ar:Sign>${sign}</ar:Sign>
        <ar:Cuit>${config.cuit}</ar:Cuit>
      </ar:Auth>
      <ar:FeCompConsReq>
        <ar:CbteTipo>${tipo}</ar:CbteTipo>
        <ar:CbteNro>${nro}</ar:CbteNro>
        <ar:PtoVta>${pv}</ar:PtoVta>
      </ar:FeCompConsReq>
    </ar:FECompConsultar>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function _parsearRespuestaCAE(xml) {
  // Faults SOAP + errores a nivel solicitud (Errors > Err)
  _assertSinFaultNiError(xml);

  const result = (xml.match(/<Resultado>([ARP])<\/Resultado>/) || [])[1];

  // Observaciones: motivos cuando AFIP rechaza (Resultado='R') o avisos (Resultado='A')
  const obs = [...xml.matchAll(/<Obs>[\s\S]*?(?:<Code>(\d+)<\/Code>)?[\s\S]*?<Msg>([\s\S]+?)<\/Msg>[\s\S]*?<\/Obs>/g)]
    .map(m => `${m[1] ? '[' + m[1] + '] ' : ''}${m[2].trim()}`);

  if (result === 'R') {
    throw new Error(`ARCA rechazó el comprobante: ${obs.join(' | ') || 'sin detalle'}`);
  }

  const cae = xml.match(/<CAE>(\d+)<\/CAE>/);
  const vto = xml.match(/<CAEFchVto>(\d{8})<\/CAEFchVto>/);
  const nro = xml.match(/<CbteDesde>(\d+)<\/CbteDesde>/);

  if (!cae || !cae[1]) {
    throw new Error(`ARCA no devolvió CAE${obs.length ? ': ' + obs.join(' | ') : ''}.\n${xml.slice(0, 600)}`);
  }

  return {
    CAE:            cae[1],
    CAEFchVto:      vto ? `${vto[1].slice(0,4)}-${vto[1].slice(4,6)}-${vto[1].slice(6,8)}` : null,
    nroComprobante: nro ? parseInt(nro[1], 10) : null,
    resultado:      result || 'A',
    observaciones:  obs.length ? obs : undefined,
  };
}

// Una única llamada SOAP. Resuelve con { status, body } (sin interpretar el body).
function _singlePost(action, body) {
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
      // El servidor de producción de ARCA (servicios1.afip.gov.ar) negocia con
      // parámetros Diffie-Hellman débiles que OpenSSL 3 (Node 20+) rechaza por
      // defecto (SECLEVEL 2) con "dh key too small", lo que se manifiesta como
      // timeout. Bajar a SECLEVEL 1 permite el handshake sin afectar homologación.
      ciphers: 'DEFAULT@SECLEVEL=1',
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    // ARCA producción responde habitualmente en <2s, pero en días de saturación
    // demora 25-40s. Con el timeout viejo de 20s la facturación se caía entera
    // (2026-08-11). Configurable por si hace falta ajustarlo sin redeploy.
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error(`WSFE timeout en ${action}`)));
    req.write(body);
    req.end();
  });
}

const _sleep = ms => new Promise(r => setTimeout(r, ms));

// Envuelve _singlePost con reintentos ante errores transitorios de ARCA.
// AFIP producción devuelve 503 "Service Unavailable" de forma intermitente
// (probado: ~2 de cada 3 requests). Un 5xx significa que el front-end de AFIP
// rechazó el pedido SIN procesarlo, por lo que reintentar es seguro incluso para
// FECAESolicitar (no genera comprobante duplicado). Los timeouts y errores de red
// NO se reintentan (ambiguos: el comprobante podría haberse emitido).
async function _soapPost(action, body, maxIntentos = 4) {
  let ultimoStatus;
  for (let intento = 1; intento <= maxIntentos; intento++) {
    const { status, body: resp } = await _singlePost(action, body);
    if (status < 500) return resp;              // 200 (o error SOAP a interpretar aguas arriba)
    ultimoStatus = status;
    if (intento < maxIntentos) await _sleep(800 * intento);  // backoff: 0.8s, 1.6s, 2.4s
  }
  throw new Error(
    `ARCA no disponible (HTTP ${ultimoStatus}) en ${action} tras ${maxIntentos} intentos. ` +
    `El servicio de AFIP está caído o saturado; reintentá en unos minutos.`
  );
}

module.exports = { solicitarCAE, ultimoNroComprobante, consultarComprobante };
