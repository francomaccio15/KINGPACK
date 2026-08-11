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

export default function AjustarSaldo({
  clienteId,
  saldoActual,
}: {
  clienteId: string;
  saldoActual: number;
}) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [tipo, setTipo]       = useState<'cargo' | 'credito'>('cargo');
  const [monto, setMonto]     = useState('');
  const [motivo, setMotivo]   = useState('');

  const cerrar = () => {
    setOpen(false); setError(''); setTipo('cargo'); setMonto(''); setMotivo('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(parseFloat(monto) > 0)) { setError('Ingresá un monto mayor a 0'); return; }
    if (!motivo.trim()) { setError('Ingresá un motivo'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clientes/${clienteId}/ajuste-saldo`, {
        method: 'POST',
        body: JSON.stringify({ monto: parseFloat(monto), tipo, motivo: motivo.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al ajustar el saldo');
      cerrar();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const montoNum   = parseFloat(monto) || 0;
  const delta      = tipo === 'credito' ? -montoNum : montoNum;
  const saldoNuevo = saldoActual + delta;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-kp-border
          text-kp-gray hover:text-kp-white hover:border-kp-gray text-sm font-medium transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Ajustar Saldo
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) cerrar(); }}
        >
          <div className="w-full max-w-sm bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-kp-red rounded-full block" />
                <h3 className="font-bold text-base uppercase tracking-wide">Ajustar Saldo</h3>
              </div>
              <button onClick={cerrar} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">

              {/* Saldo actual */}
              <div className="flex justify-between items-center rounded-xl bg-kp-surface2 border border-kp-border px-4 py-3">
                <span className="text-xs text-kp-gray uppercase tracking-widest">Saldo actual</span>
                <span className={`font-bold tabular-nums ${saldoActual > 0 ? 'text-amber-400' : saldoActual < 0 ? 'text-green-400' : 'text-kp-gray'}`}>
                  {ars.format(saldoActual)}
                </span>
              </div>

              {/* Tipo de ajuste */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Tipo de ajuste *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setTipo('cargo')}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                      ${tipo === 'cargo'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                        : 'border-kp-border bg-kp-surface2 text-kp-gray hover:border-kp-gray hover:text-kp-white'}`}>
                    Sumar deuda
                  </button>
                  <button type="button" onClick={() => setTipo('credito')}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                      ${tipo === 'credito'
                        ? 'border-green-500 bg-green-500/10 text-green-300'
                        : 'border-kp-border bg-kp-surface2 text-kp-gray hover:border-kp-gray hover:text-kp-white'}`}>
                    Saldo a favor
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-kp-gray/70">
                  {tipo === 'cargo'
                    ? 'Aumenta lo que el cliente debe.'
                    : 'Baja la deuda o genera crédito a favor del cliente.'}
                </p>
              </div>

              {/* Monto */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
                  <NumericInput
                    required
                    value={monto} onChange={e => setMonto(e.target.value)}
                    placeholder="0.00" autoFocus
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-6 pr-3 py-2 text-sm text-kp-white
                      placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                  />
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Motivo *</label>
                <input
                  value={motivo} onChange={e => setMotivo(e.target.value)}
                  placeholder="ej: deuda anterior, ajuste manual…"
                  className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                    placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                />
              </div>

              {/* Saldo resultante */}
              {montoNum > 0 && (
                <div className="flex justify-between items-center rounded-xl bg-kp-surface2 border border-kp-border px-4 py-3">
                  <span className="text-xs text-kp-gray uppercase tracking-widest">Saldo resultante</span>
                  <span className={`font-bold tabular-nums ${saldoNuevo > 0 ? 'text-amber-400' : saldoNuevo < 0 ? 'text-green-400' : 'text-kp-gray'}`}>
                    {ars.format(saldoNuevo)}
                  </span>
                </div>
              )}

              {error && (
                <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={cerrar}
                  className="flex-1 py-2 rounded-lg border border-kp-border text-kp-gray text-sm hover:text-kp-white hover:border-kp-gray transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading || !monto || !motivo.trim()}
                  className="flex-1 py-2 rounded-lg bg-kp-red hover:bg-kp-red-dark disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                  {loading ? 'Guardando…' : 'Confirmar Ajuste'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
