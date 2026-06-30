'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Genera el QR de AFIP a partir de la URL guardada (facturacion.qr_url) y lo
// renderiza como imagen, visible en pantalla y en la impresión de la factura.
export default function FacturaQR({ url, size = 92 }: { url?: string | null; size?: number }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { margin: 1, width: size * 3, errorCorrectionLevel: 'M' })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [url, size]);

  if (!src) return null;
  return (
    <img
      src={src}
      alt="Código QR AFIP"
      width={size}
      height={size}
      style={{ width: size, height: size, display: 'block' }}
    />
  );
}
