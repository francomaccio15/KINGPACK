'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

export default function RegistrarPago({ clienteId, saldoActual }: { clienteId: string; saldoActual: number }) {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [monto, setMonto]     = useState('');
  const [concepto, setConcepto] = useState('');

  const cerrar = () => { setOpen(false); setError(''); setMonto(''); setConcepto(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch(`/api/clientes/${clienteId}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: parseFloat(monto), concepto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al registrar pago');
      cerrar();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const montoNum    = parseFloat(monto) || 0;
  const saldoNuevo  = saldoActual - montoNum;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
          bg-green-700 hover:bg-green-600 transition-colors text-white text-sm font-semibold"
      >
        + Registrar Pago
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) cerrar(); }}
        >
          <div className="w-full max-w-sm bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-green-500 rounded-full block" />
                <h3 className="font-bold text-base uppercase tracking-wide">Registrar Pago</h3>
              </div>
              <button onClick={cerrar} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Saldo actual */}
              <div className="flex justify-between items-center rounded-xl bg-kp-surface2 border border-kp-border px-4 py-3">
                <span className="text-xs text-kp-gray uppercase tracking-widest">Saldo actual</span>
                <span className={`font-bold tabular-nums ${saldoActual > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {ars.format(saldoActual)}
                </span>
              </div>

              {/* Monto */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
                  <input
                    required type="number" min="0.01" step="0.01"
                    value={monto} onChange={e => setMonto(e.target.value)}
                    placeholder="0.00" autoFocus
                    className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-6 pr-3 py-2 text-sm text-kp-white
                      placeholder:text-kp-gray focus:outline-none focus:border-green-500 transition-colors"
                  />
                </div>
              </div>

              {/* Concepto */}
              <div>
                <label className="block text-xs text-kp-gray uppercase tracking-widest mb-1">Concepto</label>
                <input
                  value={concepto} onChange={e => setConcepto(e.target.value)}
                  placeholder="ej: Transferencia banco, efectivo..."
                  className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                    placeholder:text-kp-gray focus:outline-none focus:border-green-500 transition-colors"
                />
              </div>

              {/* Saldo resultante */}
              {montoNum > 0 && (
                <div className="flex justify-between items-center rounded-xl bg-kp-surface2 border border-green-700/40 px-4 py-3">
                  <span className="text-xs text-kp-gray uppercase tracking-widest">Saldo resultante</span>
                  <span className={`font-bold tabular-nums ${saldoNuevo > 0 ? 'text-amber-400' : 'text-green-400'}`}>
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
                <button type="submit" disabled={loading || !monto}
                  className="flex-1 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                  {loading ? 'Guardando…' : 'Confirmar Pago'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </>
  );
}
