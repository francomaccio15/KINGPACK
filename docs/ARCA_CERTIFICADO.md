# Guía: Obtener Certificado Digital ARCA para Facturación Electrónica

**Sistema:** KingPack  
**CUIT:** 30-71792696-6  
**Fecha de preparación:** Mayo 2026  
**Preparado por:** MaccioTEC  

---

## ¿Para qué sirve esto?

KingPack necesita un **certificado digital** para poder comunicarse con los servidores de ARCA (ex-AFIP) y generar facturas electrónicas con CAE en forma automática. Sin este certificado, la facturación electrónica no funciona.

Este trámite se hace **una sola vez**. Una vez obtenido el certificado, el sistema genera facturas 24/7 sin intervención humana.

---

## Quién debe hacer este trámite

Cualquier persona que tenga **Clave Fiscal nivel 3 o superior** de King Pack (CUIT 30-71792696-6). Puede ser:
- El titular de la empresa
- El contador con delegación en la clave fiscal

---

## Tiempo estimado

**15 a 20 minutos.** No requiere esperar aprobación de AFIP — es automático.

---

## Antes de empezar

El equipo técnico (MaccioTEC) ya generó la **solicitud de certificado (CSR)** que necesitás subir al portal de AFIP. Está guardada en los servidores de KingPack.

**No hace falta que generes nada vos — solo subís el archivo que te damos.**

Pedile a MaccioTEC el archivo `kingpack_afip.csr` antes de empezar. También podés copiarlo desde acá:

```
-----BEGIN CERTIFICATE REQUEST-----
MIICmTCCAYECAQAwVDELMAkGA1UEBhMCQVIxEjAQBgNVBAoMCUtpbmcgUGFjazEW
MBQGA1UEAwwNa2luZ3BhY2stYXJjYTEZMBcGA1UEBRMQQ1VJVCAzMDcxNzkyNjk2
NjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALOPNR8Da9lT3GN1iHvn
2UswJaGS6s5c0BxjWjx578929F7VqhF5o/xWPYkSgrg80ve8jlSSqlB3j3w/CgDY
jS61BTdmk/Qsg0pwwitO9V6VeaO93wmYwnGRJ9hf5nHH/pBSCbLB/aDaItDFybZ2
miQRF7If+8VSt9yXEpizJOkkkTRF0k4wEVKEgcxH02Q3sIqc/SaW8qSsI6NiSc0C
bnVDPEAHKMxDdShUM9li8jyFi9TpxyuWVbTFNSt0a7lj4RV8XAMJmLRP/J8P06P5
3q0G9wU7eSS7JQSggg+RyPgH5BXUYkewBtf66iAF7/HsoGvPYSPyZswxMQcD539Q
Bu8CAwEAAaAAMA0GCSqGSIb3DQEBCwUAA4IBAQAtVW3v7pjLIteUJarAcB7qYRSG
u3YhAeBXCQQMDYZQwRuoJwuwPlaCXOMwiokIu/9vrir6W8o+7hVZB71gAuIYKO36
87PHTqbL+wvv9yR7KPKsGmemAE8EXMrdTNQCnESIRYcgzpwcTuQxHR+PwVNRYYCt
PvMCc8a+tvCP2lfN6uypiPaPLVsjEJiEerfJUvSWVY00gDDrPRLjxxncTHgMYNUv
Y8buC/eCf5RTnD8XaF4erKr4XzL0L+EB7nrJcxzz2s1M2rbstoLMPB27aIIROT1F
e977d4cJyYnX5iG1x8IyCWblWqf/sH0+pfTQpOUhBI8woixQKnIvCdzsk6km
-----END CERTIFICATE REQUEST-----
```

Guardá este texto en un archivo llamado `kingpack_afip.csr` (Bloc de Notas → Guardar como → nombre `kingpack_afip.csr`, tipo "Todos los archivos").

---

## Pasos

### Paso 1 — Adherir el servicio WSASS en AFIP

1. Ingresá a **https://www.afip.gob.ar** con la clave fiscal de King Pack (CUIT 30-71792696-6)
2. En el menú principal, hacé clic en **"Administrador de Relaciones de Clave Fiscal"**
3. Buscá el servicio **"WSASS"** (podés escribirlo en el buscador)
4. Hacé clic en **"Adherir servicio"**
5. Confirmá y cerrá sesión

> Si el servicio WSASS ya aparece en tu lista de servicios, saltá directamente al Paso 2.

---

### Paso 2 — Ingresar a WSASS y crear el certificado

1. Volvé a ingresar con la clave fiscal de King Pack
2. En el menú de servicios, ingresá a **"WSASS"**
3. Hacé clic en **"Agregar alias"** o **"Nuevo certificado"**
4. En el campo que pide el certificado/CSR, **pegá el contenido del archivo `kingpack_afip.csr`** (todo el texto incluyendo las líneas `-----BEGIN...` y `-----END...`)
5. Hacé clic en **"Generar"** o **"Crear"**
6. AFIP va a generar un certificado en segundos. **Descargá el archivo `.crt`** que te ofrece

> Guardá el archivo `.crt` — necesitás enviárselo a MaccioTEC para activar la facturación.

---

### Paso 3 — Autorizar el web service de facturación

Dentro de WSASS, después de crear el certificado:

1. Buscá la opción **"Autorizar web service"** o **"Agregar autorización"**
2. Seleccioná el certificado que acabás de crear
3. En **"CUIT a representar"** ingresá: `30717926966`
4. En **"Web service"** seleccioná: **`wsfe`** (Factura Electrónica — WS de Facturación v1)
5. Confirmá

---

### Paso 4 — Enviar el certificado a MaccioTEC

Enviá el archivo `.crt` descargado en el Paso 2 a:

- **Email:** ivanmaccio12@gmail.com  
- **WhatsApp MaccioTEC:** +549 387 462-4579

Con ese archivo, el equipo técnico activa la facturación electrónica en el sistema en menos de una hora.

---

## Ambiente de prueba vs. producción

Este proceso configura el sistema en **modo de prueba (homologación)**. Eso significa que:

- Las facturas se generan con un **CAE real** del servidor de ARCA
- Los datos son ficticios — no hay impacto impositivo
- Sirve para validar que todo funciona correctamente antes de salir en vivo

Cuando el sistema esté listo para producción, el mismo certificado se puede usar en el ambiente real o se genera uno nuevo en 10 minutos siguiendo el mismo proceso pero en la sección de "Certificados Digitales de Producción".

---

## ¿Problemas?

| Situación | Qué hacer |
|-----------|-----------|
| No encuentro WSASS en la lista de servicios | Buscarlo por nombre completo "Web Services Autoservicio de Acceso" |
| Dice que el CUIT no puede representarse | Verificar que el nivel de clave fiscal sea 3 o superior |
| No puedo descargar el .crt | Probar con otro navegador (Chrome o Firefox) |
| Cualquier otra duda | Llamar a MaccioTEC: +549 387 462-4579 |

---

## Datos técnicos de referencia (para el equipo de sistemas)

| Item | Valor |
|------|-------|
| CUIT empresa | 30-71792696-6 |
| Clave privada (en servidor) | `/var/www/KINGPACK/certs/kingpack_afip.key` |
| CSR (en servidor) | `/var/www/KINGPACK/certs/kingpack_afip.csr` |
| Certificado (pendiente) | `/var/www/KINGPACK/certs/kingpack_afip.crt` |
| Endpoint WSAA testing | `https://wsaahomo.afip.gov.ar/ws/services/LoginCms` |
| Endpoint WSFE testing | `https://wswhomo.afip.gov.ar/wsfev1/service.asmx` |
| Endpoint WSAA producción | `https://wsaa.afip.gov.ar/ws/services/LoginCms` |
| Endpoint WSFE producción | `https://servicios1.afip.gov.ar/wsfev1/service.asmx` |
| Env var activación | `AFIP_HOMO=true` (testing) / `AFIP_HOMO=false` (producción) |
