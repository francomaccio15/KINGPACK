'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';

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

type MedioPago   = { id: string; nombre: string };
type Subrubro    = { id: string; nombre: string };
type Rubro       = { id: string; nombre: string; subrubros: Subrubro[] };
type MedioLinea  = { medio_pago_id: string; monto: string };
type ChequeLinea = { banco: string; numero_cheque: string; fecha_vencimiento: string; importe: string };

const TIPOS = [
  { value: 'ingreso', label: 'Ingreso', color: 'border-green-500/40 text-green-400 bg-green-500/5 hover:bg-green-500/15' },
  { value: 'egreso',  label: 'Egreso',  color: 'border-kp-red/40 text-kp-red bg-kp-red/5 hover:bg-kp-red/15' },
  { value: 'retiro',  label: 'Retiro',  color: 'border-amber-500/40 text-amber-400 bg-amber-500/5 hover:bg-amber-500/15' },
];

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 });
const fmt = (n: number) => ars.format(n);

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
  const [open, setOpen]             = useState(false);
  const [tipo, setTipo]             = useState<'ingreso' | 'egreso' | 'retiro'>('ingreso');
  const [concepto, setConcepto]     = useState('');
  const [subrubroId, setSubrubroId] = useState('');
  const [rubros, setRubros]         = useState<Rubro[]>([]);
  const [medios, setMedios]         = useState<MedioLinea[]>([]);
  const [cheques, setCheques]       = useState<ChequeLinea[]>([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Detectar si algún medio seleccionado es cheque
  const esCheque = (id: string) => /cheque/i.test(mediosPago.find(m => m.id === id)?.nombre ?? '');
  const hayCheque = medios.some(m => esCheque(m.medio_pago_id));

  const totalCheques = cheques.reduce((s, c) => s + (parseFloat(c.importe) || 0), 0);
  const montoLinea   = (m: MedioLinea) => esCheque(m.medio_pago_id) ? totalCheques : (parseFloat(m.monto) || 0);
  const totalMedios  = medios.reduce((s, m) => s + montoLinea(m), 0);

  // Cargar rubros de gasto al abrir
  useEffect(() => {
    if (!open) return;
    apiFetch('/api/egresos/rubros').then(r => r.json()).then(setRubros).catch(() => {});
  }, [open]);

  // Sincronizar fila de cheque al agregar/quitar ese medio
  useEffect(() => {
    if (hayCheque) {
      setCheques(prev => prev.length === 0
        ? [{ banco: '', numero_cheque: '', fecha_vencimiento: '', importe: '' }]
        : prev);
    } else {
      setCheques([]);
    }
  }, [hayCheque]);

  const reset = () => {
    setTipo('ingreso');
    setConcepto('');
    setSubrubroId('');
    setError(null);
    setCheques([]);
    setMedios(mediosPago.length > 0 ? [{ medio_pago_id: mediosPago[0].id, monto: '' }] : []);
  };

  // ── Medios ─────────────────────────────────────────────────────────────────
  const addMedio = () => {
    const usados = new Set(medios.map(m => m.medio_pago_id));
    const libre  = mediosPago.find(m => !usados.has(m.id)) ?? mediosPago[0];
    if (libre) setMedios(p => [...p, { medio_pago_id: libre.id, monto: '' }]);
  };
  const updMedio = (i: number, field: keyof MedioLinea, val: string) =>
    setMedios(p => p.map((m, j) => j === i ? { ...m, [field]: val } : m));
  const delMedio = (i: number) =>
    setMedios(p => p.length > 1 ? p.filter((_, j) => j !== i) : p);

  // ── Cheques ────────────────────────────────────────────────────────────────
  const addCheque = () =>
    setCheques(p => [...p, { banco: '', numero_cheque: '', fecha_vencimiento: '', importe: '' }]);
  const updCheque = (i: number, f: keyof ChequeLinea, v: string) =>
    setCheques(p => p.map((c, j) => j === i ? { ...c, [f]: v } : c));
  const delCheque = (i: number) =>
    setCheques(p => p.filter((_, j) => j !== i));

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    if (!concepto.trim()) { setError('El concepto es requerido'); return; }
    if (medios.length === 0) { setError('Agregá al menos un medio de pago'); return; }
    if (medios.some(m => !esCheque(m.medio_pago_id) && (parseFloat(m.monto) || 0) <= 0)) {
      setError('Ingresá el monto de cada medio de pago'); return;
    }
    if (hayCheque && cheques.filter(c => parseFloat(c.importe) > 0).length === 0) {
      setError('Cargá el detalle y el importe de los cheques'); return;
    }
    if (totalMedios <= 0) { setError('El monto total debe ser mayor a 0'); return; }

    setSaving(true);
    setError(null);
    try {
      const mediosPayload = medios.map(m => ({
        medio_pago_id: m.medio_pago_id || null,
        monto: esCheque(m.medio_pago_id) ? totalCheques : parseFloat(m.monto),
      }));

      const body: Record<string, unknown> = {
        tipo,
        concepto: concepto.trim(),
        medios: mediosPayload,
        ...(hayCheque && cheques.length > 0 ? { cheques } : {}),
        ...(tipo === 'egreso' && subrubroId ? { subrubro_gasto_id: subrubroId } : {}),
      };

      const res = await apiFetch(`/api/caja/${cajaId}/movimiento`, {
        method: 'POST',
        body: JSON.stringify(body),
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
          <div className="w-full max-w-lg bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-kp-border bg-kp-surface2 flex-shrink-0">
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

            {/* Body — scrollable */}
            <div className="p-5 space-y-4 overflow-y-auto">

              {/* Tipo */}
              <div>
                <label className={labelCls}>Tipo</label>
                <div className="flex gap-2">
                  {TIPOS.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => { setTipo(t.value as typeof tipo); setSubrubroId(''); }}
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

              {/* Rubro — solo para egresos */}
              {tipo === 'egreso' && rubros.length > 0 && (
                <div>
                  <label className={labelCls}>
                    Rubro <span className="normal-case font-normal text-kp-gray/60">(opcional)</span>
                  </label>
                  <select value={subrubroId} onChange={e => setSubrubroId(e.target.value)} className={inputCls}>
                    <option value="">— Sin categoría —</option>
                    {rubros.map(r => (
                      <optgroup key={r.id} label={r.nombre}>
                        {r.subrubros.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}

              {/* ── Medios de pago ───────────────────────────────────────────── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>
                    Medios de pago *
                    <span className="ml-1 normal-case font-normal text-kp-gray/60">— podés combinar</span>
                  </label>
                  <button
                    type="button"
                    onClick={addMedio}
                    disabled={medios.length >= mediosPago.length}
                    className="flex items-center gap-1 text-xs font-semibold text-white bg-kp-red/80 hover:bg-kp-red transition-colors px-2.5 py-1 rounded-lg disabled:opacity-40"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-3 h-3">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Agregar
                  </button>
                </div>

                {medios.map((m, i) => {
                  const esCh = esCheque(m.medio_pago_id);
                  return (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end rounded-lg border border-kp-border bg-kp-surface2/40 p-2">
                      <div className="col-span-6">
                        <label className={labelCls}>Medio</label>
                        <select
                          value={m.medio_pago_id}
                          onChange={e => updMedio(i, 'medio_pago_id', e.target.value)}
                          className={inputCls}
                        >
                          {mediosPago.map(mp => <option key={mp.id} value={mp.id}>{mp.nombre}</option>)}
                        </select>
                      </div>
                      <div className="col-span-5">
                        <label className={labelCls}>Monto</label>
                        {esCh ? (
                          <div className={`${inputCls} flex items-center justify-between text-kp-gray-lt cursor-default`}>
                            <span className="tabular-nums">{fmt(totalCheques)}</span>
                            <span className="text-[10px] text-kp-gray">según cheques ↓</span>
                          </div>
                        ) : (
                          <NumericInput
                            value={m.monto}
                            placeholder="0.00"
                            onChange={e => updMedio(i, 'monto', e.target.value)}
                            className={inputCls}
                          />
                        )}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {medios.length > 1 && (
                          <button
                            type="button"
                            onClick={() => delMedio(i)}
                            title="Quitar medio"
                            className="text-kp-gray hover:text-kp-red px-2 py-2 transition-colors"
                          >✕</button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Resumen total cuando hay más de un medio */}
                {medios.length > 1 && (
                  <div className="flex items-center justify-between rounded-lg bg-kp-surface2 border border-kp-border px-4 py-2">
                    <span className="text-xs uppercase tracking-widest text-kp-gray">Total</span>
                    <span className={`text-sm font-bold tabular-nums ${totalMedios > 0 ? 'text-kp-white' : 'text-kp-gray'}`}>
                      {fmt(totalMedios)}
                    </span>
                  </div>
                )}
              </div>

              {/* ── Detalle de cheques ────────────────────────────────────────── */}
              {hayCheque && (
                <div className="space-y-3 pt-2 border-t border-kp-border">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-kp-gray">
                      Cheques ({cheques.length})
                    </p>
                    <button
                      type="button"
                      onClick={addCheque}
                      className="flex items-center gap-1 text-xs font-semibold text-white bg-kp-red/80 hover:bg-kp-red transition-colors px-2.5 py-1 rounded-lg"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="w-3 h-3">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Agregar cheque
                    </button>
                  </div>

                  {cheques.map((ch, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2 items-end rounded-lg border border-kp-border bg-kp-surface2/40 p-3">
                      <div>
                        <label className={labelCls}>Banco</label>
                        <input
                          type="text"
                          value={ch.banco}
                          placeholder="Banco Nación…"
                          onChange={e => updCheque(i, 'banco', e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>N° Cheque</label>
                        <input
                          type="text"
                          value={ch.numero_cheque}
                          placeholder="00000000"
                          onChange={e => updCheque(i, 'numero_cheque', e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Fecha del cheque *</label>
                        <input
                          type="date"
                          value={ch.fecha_vencimiento}
                          onChange={e => updCheque(i, 'fecha_vencimiento', e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Importe *</label>
                        <div className="flex gap-2">
                          <NumericInput
                            value={ch.importe}
                            placeholder="0.00"
                            onChange={e => updCheque(i, 'importe', e.target.value)}
                            className={inputCls}
                          />
                          {cheques.length > 1 && (
                            <button
                              type="button"
                              onClick={() => delCheque(i)}
                              className="self-stretch px-2 text-kp-gray hover:text-kp-red transition-colors"
                            >✕</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Total cheques */}
                  <div className="flex items-center justify-between rounded-lg bg-kp-surface2 border border-kp-border px-4 py-2">
                    <span className="text-xs uppercase tracking-widest text-kp-gray">Total cheques</span>
                    <span className={`text-sm font-bold tabular-nums ${totalCheques > 0 ? 'text-kp-white' : 'text-kp-gray'}`}>
                      {fmt(totalCheques)}
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleGuardar}
                  disabled={saving || totalMedios <= 0}
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
