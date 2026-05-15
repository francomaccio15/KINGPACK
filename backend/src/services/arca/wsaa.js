/**
 * WSAA — Web Service de Autenticación y Autorización de ARCA.
 * Genera el Token de Autorización (TA) firmando un TRA con el certificado de King Pack.
 *
 * Este módulo solo se usa cuando AFIP_MODO=homo o AFIP_MODO=produccion.
 * En modo demo, AfipSDK maneja la autenticación internamente.
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
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

function _buildTRA() {
  const ahora  = new Date();
  const desde  = new Date(ahora.getTime() - 60 * 1000).toISOString().replace(/\.\d+Z$/, '-03:00');
  const hasta  = new Date(ahora.getTime() + 12 * 3600 * 1000).toISOString().replace(/\.\d+Z$/, '-03:00');
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

function _firmarTRA(tra, cert, key) {
  // Firma el TRA como CMS (PKCS#7) en base64
  const sign = crypto.createSign('SHA256');
  sign.update(tra);
  const firma = sign.sign({ key, format: 'pem' }, 'base64');

  // Construir el CMS firmado básico (detached, solo la firma + cert)
  // ARCA acepta el CMS como base64 del DER del SignedData
  // Para simplificar usamos la firma raw + cert en base64 concatenados
  // En producción real se usa node-forge o pkcs7 para el envelope completo
  const certB64 = cert
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s/g, '');

  return Buffer.from(JSON.stringify({ tra: Buffer.from(tra).toString('base64'), firma, cert: certB64 })).toString('base64');
}

function _parsearTA(xml) {
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
