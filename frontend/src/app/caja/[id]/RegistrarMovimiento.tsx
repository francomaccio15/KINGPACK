'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type MedioPago = { id: string; nombre: string };

const TIPOS = [
  { value: 'ingreso', label: 'Ingreso',  color: 'border-green-500/40 text-green-400 bg-green-500/5 hover:bg-green-500/15' },
  { value: 'egreso',  label: 'Egreso',   color: 'border-kp-red/40 text-kp-red bg-kp-red/5 hover:bg-kp-red/15' },
  { value: 'retiro',  label: 'Retiro',   color: 'border-amber-500/40 text-amber-400 bg-amber-500/5 hover:bg-amber-500/15' },
];

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function RegistrarMovimiento({
  cajaId,
  mediosPago,
}: {
  cajaId: string;
  mediosPago: MedioPago[];
}) {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [tipo, setTipo]         = useState<'ingreso' | 'egreso' | 'retiro'>('ingreso');
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto]       = useState('');
  const [medioId, setMedioId]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const reset = () => {
    setTipo('ingreso');
    setConcepto('');
    setMonto('');
    setMedioId('');
    setError(null);
  };

  const handleGuardar = async () => {
    if (!concepto.trim()) { setError('El concepto es requerido'); return; }
    if (!monto || parseFloat(monto) <= 0) { setError('El monto debe ser mayor a 0'); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/caja/${cajaId}/movimiento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          concepto: concepto.trim(),
          monto: parseFloat(monto),
          medio_pago_id: medioId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return; }
      setOpen(false);
      reset();
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
        onClick={() => { reset(); setOpen(true); }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-kp-border text-sm text-kp-gray-lt font-semibold hover:text-kp-white hover:border-kp-gray transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Movimiento
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-5 py-4 border-b border-kp-border bg-kp-surface2">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-kp-red rounded-full block" />
                <h3 className="text-sm font-bold uppercase tracking-wide">Registrar Movimiento</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-kp-gray hover:text-kp-white transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">

              {/* Tipo */}
              <div>
                <label className={labelCls}>Tipo</label>
                <div className="flex gap-2">
                  {TIPOS.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTipo(t.value as typeof tipo)}
                      className={[
                        'flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors',
                        tipo === t.value ? t.color : 'border-kp-border text-kp-gray hover:border-kp-gray',
                      ].join(' ')}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Concepto */}
              <div>
                <label className={labelCls}>Concepto *</label>
                <input
                  type="text"
                  placeholder={tipo === 'ingreso' ? 'Ej: Depósito de gerencia' : tipo === 'egreso' ? 'Ej: Compra de insumos' : 'Ej: Retiro cierre de turno'}
                  value={concepto}
                  onChange={e => setConcepto(e.target.value)}
                  className={inputCls}
                  autoFocus
                />
              </div>

              {/* Monto */}
              <div>
                <label className={labelCls}>Monto *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* Medio de pago */}
              <div>
                <label className={labelCls}>Medio de Pago</label>
                <select
                  value={medioId}
                  onChange={e => setMedioId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Sin especificar —</option>
                  {mediosPago.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleGuardar}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50"
                >
                  {saving ? <><Spinner /> Guardando…</> : 'Registrar'}
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
