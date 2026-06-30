/**
 * WSAA — Web Service de Autenticación y Autorización de ARCA.
 * Genera el Token de Autorización (TA) firmando un TRA con el certificado de King Pack.
 *
 * Este módulo solo se usa cuando AFIP_MODO=homo o AFIP_MODO=produccion.
 * En modo demo, AfipSDK maneja la autenticación internamente.
 */

const fs     = require('fs');
const crypto = require('crypto');
const https  = require('https');
const forge  = require('node-forge');
const config = require('./config');
const store  = require('./token-store');

const SERVICIO = 'wsfe';

/**
 * Retorna el token y sign vigentes.
 * Si el token en cache es válido, lo devuelve directamente.
 * Si no, autentica contra WSAA y cachea el nuevo token.
 */
async function getToken() {
  const cached = store.get(config.cuit, SERVICIO);
  if (cached) return cached;

  const { token, sign, expira } = await _autenticar();
  const ttl = expira - Date.now() - 5 * 60 * 1000; // 5 min de margen
  store.set(config.cuit, SERVICIO, token, sign, ttl);
  return { token, sign };
}

async function _autenticar() {
  _assertCertificados();

  const cert = fs.readFileSync(config.certPath, 'utf8');
  const key  = fs.readFileSync(config.keyPath,  'utf8');

  const tra = _buildTRA();
  const cms = _firmarTRA(tra, cert, key);

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cms}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const xml = await _soapPost(config.endpoints.wsaa, soapBody, 'loginCms');
  return _parsearTA(xml);
}

// Formatea un instante en horario Argentina (-03:00). El servidor corre en UTC;
// restamos 3h para obtener los componentes locales y les anexamos el offset -03:00,
// de modo que el instante representado sea correcto (no en el futuro).
function _fechaAfip(date) {
  const ar = new Date(date.getTime() - 3 * 3600 * 1000);
  return ar.toISOString().replace(/\.\d+Z$/, '-03:00');
}

function _buildTRA() {
  const ahora  = new Date();
  const desde  = _fechaAfip(new Date(ahora.getTime() - 10 * 60 * 1000)); // 10 min en el pasado (margen de reloj)
  const hasta  = _fechaAfip(new Date(ahora.getTime() + 10 * 60 * 1000)); // 10 min en el futuro
  const unique = crypto.randomInt(1, 999999999);

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${unique}</uniqueId>
    <generationTime>${desde}</generationTime>
    <expirationTime>${hasta}</expirationTime>
  </header>
  <service>${SERVICIO}</service>
</loginTicketRequest>`;
}

function _firmarTRA(tra, certPem, keyPem) {
  // Firma el TRA como un CMS (PKCS#7 SignedData) en base64, que es lo que
  // espera AFIP WSAA en <loginCms>. Se usa node-forge para armar el envelope
  // completo (contenido + certificado + firma SHA-256 con la clave privada).
  const cert = forge.pki.certificateFromPem(certPem);
  const key  = forge.pki.privateKeyFromPem(keyPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate:    cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType,   value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },          // calculado por forge
      { type: forge.pki.oids.signingTime,   value: new Date() },
    ],
  });
  p7.sign();

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);
}

function _parsearTA(xml) {
  // Si AFIP devolvió un fault SOAP, surfacearlo (ej. CMS inválido, cert vencido,
  // TA ya emitido, certificado no autorizado para el servicio, etc.).
  const faultMatch = xml.match(/<faultstring>([\s\S]+?)<\/faultstring>/i);
  if (faultMatch) {
    throw new Error(`WSAA rechazó la autenticación: ${faultMatch[1].trim()}`);
  }

  const tokenMatch = xml.match(/<token>([\s\S]+?)<\/token>/);
  const signMatch  = xml.match(/<sign>([\s\S]+?)<\/sign>/);
  const expiMatch  = xml.match(/<expirationTime>([\s\S]+?)<\/expirationTime>/);

  if (!tokenMatch || !signMatch) {
    throw new Error(`WSAA: no se pudo extraer token del XML de respuesta.\n${xml.slice(0, 500)}`);
  }

  return {
    token:  tokenMatch[1].trim(),
    sign:   signMatch[1].trim(),
    expira: expiMatch ? new Date(expiMatch[1].trim()).getTime() : Date.now() + 11 * 3600 * 1000,
  };
}

function _soapPost(url, body, action) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path:     urlObj.pathname,
      method:   'POST',
      headers: {
        'Content-Type':   'text/xml; charset=utf-8',
        'SOAPAction':     `"${action}"`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('WSAA timeout')); });
    req.write(body);
    req.end();
  });
}

function _assertCertificados() {
  if (!fs.existsSync(config.certPath)) {
    throw new Error(
      `Certificado ARCA no encontrado en: ${config.certPath}\n` +
      `Seguir la guía docs/ARCA_CERTIFICADO.md para obtenerlo.`
    );
  }
  if (!fs.existsSync(config.keyPath)) {
    throw new Error(`Clave privada no encontrada en: ${config.keyPath}`);
  }
}

module.exports = { getToken };
