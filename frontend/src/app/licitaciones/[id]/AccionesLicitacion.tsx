'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, {
    ...o,
    headers: {
      'Content-Type': 'application/json',
      ...(o.headers as Record<string, string> || {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });
};

type Sucursal = { id: string; nombre: string };

export default function AccionesLicitacion({
  licitacionId,
  estadoActual,
  ventaId,
  sucursales,
}: {
  licitacionId: string;
  estadoActual: string;
  ventaId?: string | null;
  sucursales: Sucursal[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showAdjudicar, setShowAdjudicar] = useState(false);
  // Sucursal por defecto: Laprida (fallback a la primera)
  const sucursalDefault = sucursales.find(s => /laprida/i.test(s.nombre))?.id ?? sucursales[0]?.id ?? '';
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState('');
  const [errorAdj, setErrorAdj] = useState('');

  const cambiarEstado = async (estado: string) => {
    setLoading(true);
    try {
      await apiFetch(`/api/licitaciones/${licitacionId}`, {
        method: 'PUT',
        body: JSON.stringify({ estado }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const eliminar = async () => {
    if (!confirm('¿Eliminar esta licitación? Esta acción no se puede deshacer.')) return;
    setLoading(true);
    try {
      await apiFetch(`/api/licitaciones/${licitacionId}`, { method: 'DELETE' });
      router.push('/licitaciones');
    } finally {
      setLoading(false);
    }
  };

  const adjudicar = async () => {
    if (!sucursalSeleccionada) {
      setErrorAdj('Seleccioná una sucursal.');
      return;
    }
    setLoading(true);
    setErrorAdj('');
    try {
      const res = await apiFetch(`/api/licitaciones/${licitacionId}/adjudicar`, {
        method: 'POST',
        body: JSON.stringify({ sucursal_id: sucursalSeleccionada }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorAdj(data.error ?? 'Error al adjudicar');
        setLoading(false);
        return;
      }
      setShowAdjudicar(false);
      router.push(`/ventas/${data.venta_id}`);
    } catch {
      setErrorAdj('Error de conexión. Intentá de nuevo.');
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Imprimir */}
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray text-sm font-medium transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Imprimir
        </button>

        {/* Adjudicar */}
        {estadoActual === 'enviada' && (
          <button
            onClick={() => { setShowAdjudicar(true); setErrorAdj(''); setSucursalSeleccionada(sucursalDefault); }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            Adjudicar
          </button>
        )}

        {/* Link a la venta si ya fue adjudicada */}
        {estadoActual === 'adjudicada' && ventaId && (
          <a
            href={`/ventas/${ventaId}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20 text-sm font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            Ver venta generada
          </a>
        )}

        {/* Marcar enviada / volver a borrador */}
        {estadoActual === 'borrador' && (
          <button
            onClick={() => cambiarEstado('enviada')}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Marcar enviada
          </button>
        )}
        {estadoActual === 'enviada' && (
          <button
            onClick={() => cambiarEstado('borrador')}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray disabled:opacity-50 text-sm font-medium transition-colors"
          >
            Volver a borrador
          </button>
        )}

        {/* Eliminar */}
        {estadoActual !== 'adjudicada' && (
          <button
            onClick={eliminar}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-kp-red/40 text-kp-red hover:bg-kp-red/10 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Eliminar
          </button>
        )}
      </div>

      {/* ── Modal adjudicar ────────────────────────────────────────────────── */}
      {showAdjudicar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-kp-surface border border-kp-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-400">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-kp-white text-base">Adjudicar licitación</h3>
                <p className="text-xs text-kp-gray mt-0.5">Se generará una venta confirmada con los precios de la licitación.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-kp-gray mb-1.5">
                  Sucursal
                </label>
                <select
                  value={sucursalSeleccionada}
                  onChange={e => setSucursalSeleccionada(e.target.value)}
                  className="w-full bg-kp-surface2 border border-kp-border text-kp-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-500/60"
                >
                  <option value="">— Seleccioná una sucursal —</option>
                  {sucursales.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>

              {errorAdj && (
                <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">
                  {errorAdj}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowAdjudicar(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={adjudicar}
                  disabled={loading || !sucursalSeleccionada}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  {loading ? 'Procesando…' : 'Confirmar adjudicación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
