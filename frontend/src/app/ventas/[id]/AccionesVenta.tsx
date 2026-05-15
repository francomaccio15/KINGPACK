'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Facturacion = {
  cae: string;
  factura_numero: number;
  punto_venta: number;
  tipo_comprobante: string;
} | null;

export default function AccionesVenta({
  ventaId, estado, total, facturacion,
}: {
  ventaId: string;
  estado: string;
  total: string;
  facturacion: Facturacion;
}) {
  const router = useRouter();
  const [loadingFactura, setLoadingFactura] = useState(false);
  const [loadingPdf,     setLoadingPdf]     = useState(false);
  const [resultFactura,  setResultFactura]  = useState<{ CAE?: string; _mock?: boolean; error?: string } | null>(null);

  const generarFacturaTest = async () => {
    setLoadingFactura(true);
    setResultFactura(null);
    try {
      const res  = await fetch(`${API}/api/ventas/${ventaId}/factura-test`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al facturar');
      setResultFactura(data);
      router.refresh();
    } catch (err: any) {
      setResultFactura({ error: err.message });
    } finally {
      setLoadingFactura(false);
    }
  };

  const descargarPdf = async () => {
    setLoadingPdf(true);
    try {
      const res = await fetch(`${API}/api/ventas/${ventaId}/pdf`);
      if (!res.ok) throw new Error('Error al generar PDF');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `venta-${ventaId.slice(0,8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingPdf(false);
    }
  };

  const yaFacturada = !!(facturacion?.cae);

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex flex-wrap gap-2">

        {/* PDF */}
        <button
          onClick={descargarPdf}
          disabled={loadingPdf}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
            border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray
            transition-colors disabled:opacity-50"
        >
          {loadingPdf ? (
            <span className="w-4 h-4 border-2 border-kp-gray border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          )}
          Exportar PDF
        </button>

        {/* Factura oficial — deshabilitada */}
        <div className="relative group">
          <button
            disabled
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              border border-kp-border/40 text-kp-gray/30 cursor-not-allowed"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            Factura Oficial
          </button>
          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 z-10
            bg-kp-surface2 border border-kp-border rounded text-xs text-kp-gray whitespace-nowrap
            opacity-0 group-hover:opacity-100 transition-opacity">
            Próximamente — requiere clave fiscal ARCA
          </span>
        </div>

        {/* Factura test ARCA */}
        {!yaFacturada && (
          <button
            onClick={generarFacturaTest}
            disabled={loadingFactura}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              bg-kp-red hover:bg-kp-red-dark text-white transition-colors shadow shadow-kp-red/30
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loadingFactura ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            )}
            Factura Test ARCA
          </button>
        )}

      </div>

      {/* Resultado factura test */}
      {resultFactura && (
        <div className={`text-xs px-3 py-2 rounded-lg border max-w-sm ${
          resultFactura.error
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-green-500/10 border-green-500/30 text-green-400'
        }`}>
          {resultFactura.error ? (
            <>Error: {resultFactura.error}</>
          ) : (
            <>
              CAE: <span className="font-mono font-bold">{resultFactura.CAE}</span>
              {resultFactura._mock && <span className="ml-2 opacity-60">(simulado)</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
