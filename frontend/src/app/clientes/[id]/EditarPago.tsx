'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 });

export default function EditarPago({
  clienteId,
  movId,
  montoActual,
}: {
  clienteId: string;
  movId: string;
  montoActual: number;
}) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [monto, setMonto]     = useState(String(montoActual));
  const [motivo, setMotivo]   = useState('');

  const cerrar = () => {
    setOpen(false);
    setError('');
    setMonto(String(montoActual));
    setMotivo('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) { setError('Indicá el motivo de la edición'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clientes/${clienteId}/pagos/${movId}`, {
        method: 'PUT',
        body: JSON.stringify({ monto: parseFloat(monto), motivo: motivo.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al editar el pago');
      cerrar();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Editar pago"
        className="text-kp-gray hover:text-sky-400 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) cerrar(); }}
        >
          <div className="w-full max-w-sm bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-sky-500 rounded-full block" />
                <h3 className="font-bold text-base uppercase tracking-wide">Editar Pago</h3>
              </div>
              <button onClick={cerrar} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">

              {/* Monto original */}
              <div className="flex justify-between items-center rounded-xl bg-kp-surface2 border border-kp-border px-4 py-3">
                <span className="text-xs text-kp-gray uppercase tracking-widest">Monto original</span>
                <span className="font-bold tabular-nums text-kp-gray-lt">{ars.format(montoActual)}</span>
              </div>

              {/* Nuevo monto */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Nuevo monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
                  <NumericInput
                    required
                    value={monto} onChange={e => setMonto(e.target.value)}
                    placeholder="0.00" autoFocus
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-6 pr-3 py-2 text-sm text-kp-white
                      placeholder:text-kp-gray focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>

              {/* Motivo (obligatorio) */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Motivo de la edición *</label>
                <textarea
                  value={motivo} onChange={e => setMotivo(e.target.value)}
                  placeholder="ej: se cargó mal el monto, faltó descuento..."
                  rows={3}
                  className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                    placeholder:text-kp-gray focus:outline-none focus:border-sky-500 transition-colors resize-none"
                />
                <p className="text-[11px] text-kp-gray/70 mt-1">Le llega al administrador como aviso en las notificaciones.</p>
              </div>

              {error && (
                <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={cerrar}
                  className="flex-1 py-2 rounded-lg border border-kp-border text-kp-gray text-sm hover:text-kp-white hover:border-kp-gray transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading || !monto || !motivo.trim()}
                  className="flex-1 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                  {loading ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
