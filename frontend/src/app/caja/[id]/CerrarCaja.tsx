'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function CerrarCaja({
  cajaId,
  saldoSistema,
}: {
  cajaId: string;
  saldoSistema: number;
}) {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [saldoReal, setSaldo]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const saldoRealNum  = parseFloat(saldoReal) || 0;
  const diferencia    = saldoSistema - saldoRealNum;
  const hayDiferencia = Math.abs(diferencia) > 0.01;

  const handleCerrar = async () => {
    if (saldoReal === '') { setError('Ingresá el saldo real contado'); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/caja/${cajaId}/cerrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saldo_final_real: saldoRealNum }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al cerrar'); return; }
      setOpen(false);
      router.refresh();
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';

  return (
    <>
      <button
        onClick={() => { setSaldo(''); setError(null); setOpen(true); }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
        </svg>
        Cerrar Caja
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-5 py-4 border-b border-kp-border bg-kp-surface2">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-kp-red rounded-full block" />
                <h3 className="text-sm font-bold uppercase tracking-wide">Cerrar Caja — Arqueo</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-kp-gray hover:text-kp-white transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">

              {/* Saldo sistema (read-only) */}
              <div className="bg-kp-surface2 border border-kp-border rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-0.5">Saldo sistema</p>
                  <p className="text-xs text-kp-gray/60">Calculado automáticamente</p>
                </div>
                <p className="text-xl font-bold tabular-nums text-kp-white">
                  {ars.format(saldoSistema)}
                </p>
              </div>

              {/* Saldo real */}
              <div>
                <label className={labelCls}>Saldo real contado *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={saldoReal}
                  onChange={e => setSaldo(e.target.value)}
                  autoFocus
                  className={inputCls}
                />
                <p className="text-xs text-kp-gray/60 mt-1">
                  Contá el efectivo físico en la caja e ingresá el total.
                </p>
              </div>

              {/* Diferencia en tiempo real */}
              {saldoReal !== '' && (
                <div className={[
                  'rounded-xl border p-3 flex justify-between items-center',
                  !hayDiferencia
                    ? 'border-green-500/30 bg-green-500/5'
                    : diferencia > 0
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-kp-red/30 bg-kp-red/5',
                ].join(' ')}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-kp-gray">Diferencia</p>
                  <p className={[
                    'text-lg font-bold tabular-nums',
                    !hayDiferencia ? 'text-green-400'
                      : diferencia > 0 ? 'text-amber-400'
                      : 'text-kp-red',
                  ].join(' ')}>
                    {hayDiferencia && (diferencia > 0 ? '+' : '')}{ars.format(diferencia)}
                  </p>
                </div>
              )}

              {!hayDiferencia && saldoReal !== '' && (
                <p className="text-xs text-green-400 text-center">✓ Caja cuadrada perfectamente</p>
              )}

              {error && (
                <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCerrar}
                  disabled={saving || saldoReal === ''}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50"
                >
                  {saving ? <><Spinner /> Cerrando…</> : 'Confirmar Cierre'}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
