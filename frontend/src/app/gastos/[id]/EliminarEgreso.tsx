'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
};

const inputCls = 'w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors resize-none';

export default function EliminarEgreso({ egresoId }: { egresoId: string }) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [motivo, setMotivo]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleClose = () => { if (!loading) { setOpen(false); setMotivo(''); setError(''); } };

  const handleEliminar = async () => {
    if (!motivo.trim()) { setError('Ingresá un motivo para eliminar el gasto'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/egresos/${egresoId}`, {
        method: 'DELETE',
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al eliminar'); return; }
      router.push('/gastos');
      router.refresh();
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 border border-kp-red/50 text-kp-red hover:bg-kp-red/10 text-sm font-semibold rounded-lg transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
        Eliminar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative w-full max-w-md bg-kp-surface border border-kp-border rounded-2xl shadow-2xl">

            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-lg font-bold text-kp-red">Eliminar Gasto</h3>
              <button onClick={handleClose} disabled={loading} className="text-kp-gray hover:text-kp-white transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-kp-gray">
                Esta acción es irreversible. El gasto quedará eliminado del sistema pero el registro se conserva internamente con el motivo indicado.
              </p>

              <div>
                <label className="block text-xs text-kp-gray font-semibold uppercase tracking-wide mb-1">
                  Motivo de eliminación *
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej: Error de carga, duplicado, comprobante incorrecto…"
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  className={inputCls}
                  disabled={loading}
                />
              </div>

              {error && (
                <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 border border-kp-border rounded-lg text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleEliminar}
                  disabled={loading || !motivo.trim()}
                  className="flex-1 px-4 py-2.5 bg-kp-red hover:bg-kp-red/80 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-colors"
                >
                  {loading ? 'Eliminando…' : 'Confirmar eliminación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
