'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/auth';

interface Props {
  /** Qué vista exportar */
  tipo: 'ventas' | 'compras' | 'posicion';
  desde?: string;
  hasta?: string;
  anio?: string;
  sucursalId?: string;
}

export default function ExportarPDFImpuestos({ tipo, desde, hasta, anio, sucursalId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const generar = async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ tipo });
      if (tipo === 'posicion') {
        if (anio) qs.set('anio', anio);
      } else {
        if (desde) qs.set('desde', desde);
        if (hasta) qs.set('hasta', hasta);
      }
      if (sucursalId) qs.set('sucursal_id', sucursalId);

      const r = await apiFetch(`/api/impuestos/pdf?${qs}`);
      if (!r.ok) {
        let msg = 'No se pudo generar el PDF';
        try { const d = await r.json(); msg = d.error || msg; } catch { /* no-json */ }
        throw new Error(msg);
      }

      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1 print:hidden">
      <button
        onClick={generar}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white
          text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60
          disabled:cursor-not-allowed"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M12 10v6m0 0-3-3m3 3 3-3" />
          <path d="M3 17v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3" />
          <path d="M16 6l-4-4-4 4" />
        </svg>
        {loading ? 'Generando…' : 'Exportar PDF'}
      </button>
      {error && <p className="text-xs text-kp-red max-w-[240px] text-right">{error}</p>}
    </div>
  );
}
