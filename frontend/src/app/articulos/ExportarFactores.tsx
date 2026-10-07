'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '';
const getToken = () => typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;

// Planilla de factores (venta por unidad, paso 1): CSV con las unidades por
// bulto sugeridas desde el nombre, para que el depósito las verifique.
export default function ExportarFactores() {
  const [loading, setLoading] = useState(false);

  const descargar = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/articulos/export/factores`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'No se pudo generar la planilla');
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `factores-articulos-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={descargar}
      disabled={loading}
      title="Planilla CSV con las unidades por bulto sugeridas, para verificar en el depósito"
      className="flex items-center gap-2 border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray
        text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 10v6m0 0-3-3m3 3 3-3M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3M16 6l-4-4-4 4" />
      </svg>
      {loading ? 'Generando…' : 'Planilla de factores'}
    </button>
  );
}
