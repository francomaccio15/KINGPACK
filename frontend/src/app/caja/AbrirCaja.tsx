'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };

export default function AbrirCaja({
  sucursalId,
  sucursalNombre,
}: {
  sucursalId: string;
  sucursalNombre: string;
}) {
  const router = useRouter();
  const [open, setOpen]           = useState(false);
  const [saldoInicial, setSaldo]  = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleAbrir = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/caja/abrir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sucursal_id: sucursalId,
          saldo_inicial: parseFloat(saldoInicial) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al abrir caja'); return; }
      setOpen(false);
      setSaldo('');
      router.refresh();
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => { setError(null); setOpen(true); }}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-kp-red/40 text-kp-red text-sm font-semibold hover:bg-kp-red/10 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Abrir Caja
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-5 py-4 border-b border-kp-border bg-kp-surface2">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-kp-red rounded-full block" />
                <h3 className="text-sm font-bold uppercase tracking-wide">Abrir Caja</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-kp-gray hover:text-kp-white transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-kp-gray uppercase tracking-widest font-semibold mb-1">Sucursal</p>
                <p className="text-sm font-medium text-kp-white">{sucursalNombre}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1">
                  Saldo inicial (efectivo en caja)
                </label>
                <NumericInput
                  placeholder="0.00"
                  value={saldoInicial}
                  onChange={e => setSaldo(e.target.value)}
                  autoFocus
                  className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors"
                />
              </div>

              {error && (
                <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAbrir}
                  disabled={saving}
                  className="flex-1 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Abriendo…' : 'Abrir Caja'}
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
