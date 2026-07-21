'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Caja {
  sucursal_id:     string;
  sucursal_nombre: string;
  saldo:           number;
  saldo_inicial:   number;
  updated_at:      string | null;
  ingresos:        number;
  egresos:         number;
}

interface Movimiento {
  id:             string;
  fecha:          string;
  created_at:     string;
  tipo:           'ingreso' | 'egreso';
  monto:          number;
  concepto:       string | null;
  origen_tipo:    string | null;
  usuario_nombre: string | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n);

const ORIGEN_LABEL: Record<string, string> = {
  cierre_caja:    'Cierre de caja',
  egreso:         'Gasto',
  pago_proveedor: 'Pago a proveedor',
  ajuste:         'Ajuste',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const IcoVault = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="3.5" />
    <path d="M12 8.5V6M12 18v-2.5M15.5 12H18M6 12h2.5" />
  </svg>
);

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-kp-surface border border-kp-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
          <h3 className="text-sm font-bold uppercase tracking-widest text-kp-white">{title}</h3>
          <button onClick={onClose} className="text-kp-gray hover:text-kp-white transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Formulario de ajuste ─────────────────────────────────────────────────────
function FormAjuste({ caja, onGuardar, onCerrar }: { caja: Caja; onGuardar: () => void; onCerrar: () => void }) {
  const [valor, setValor]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const inputCls = 'w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';

  const nuevo = parseFloat(valor);
  const valido = Number.isFinite(nuevo) && nuevo >= 0;
  const diferencia = valido ? nuevo - caja.saldo : 0;

  const handleSubmit = async () => {
    setError(null);
    if (!valido) return setError('Ingresá un monto válido (no puede ser negativo)');
    setSaving(true);
    try {
      const res  = await apiFetch(`/api/caja-fuerte/${caja.sucursal_id}`, {
        method: 'PUT', body: JSON.stringify({ saldo: nuevo }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? 'Error al guardar');
      onGuardar();
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-kp-surface2 border border-kp-border px-4 py-3">
        <p className="text-[11px] uppercase tracking-widest text-kp-gray">Saldo actual del sistema</p>
        <p className="text-xl font-bold tabular-nums text-kp-white mt-0.5">{fmt(caja.saldo)}</p>
      </div>

      <div>
        <label className={labelCls}>Efectivo realmente contado *</label>
        <input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)}
          placeholder="0.00" className={inputCls} autoFocus />
        <p className="text-[10px] text-kp-gray mt-1">
          Pasa a ser el punto de partida. Los movimientos que se registren de acá en adelante
          (cierres de caja, gastos y pagos con efectivo de caja fuerte) se van a sumar y restar sobre este número.
        </p>
      </div>

      {valido && diferencia !== 0 && (
        <div className={`rounded-lg border px-4 py-3 ${diferencia > 0 ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
          <p className="text-[11px] uppercase tracking-widest text-kp-gray">Diferencia</p>
          <p className={`text-lg font-bold tabular-nums ${diferencia > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {diferencia > 0 ? '+' : '−'}{fmt(Math.abs(diferencia))}
          </p>
          <p className="text-[10px] text-kp-gray mt-1">
            No se registra como movimiento: es una corrección del punto de partida, no plata que entró o salió.
            El historial de movimientos queda intacto.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button onClick={onCerrar}
          className="flex-1 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors">
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving || !valido}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50">
          {saving ? <><Spinner /> Guardando…</> : 'Fijar saldo'}
        </button>
      </div>
    </div>
  );
}

// ─── Movimientos de una sucursal ──────────────────────────────────────────────
function Movimientos({ sucursalId }: { sucursalId: string }) {
  const [movs, setMovs] = useState<Movimiento[] | null>(null);

  useEffect(() => {
    apiFetch(`/api/caja-fuerte/${sucursalId}/movimientos`)
      .then(r => r.json())
      .then(d => setMovs(d.movimientos ?? []))
      .catch(() => setMovs([]));
  }, [sucursalId]);

  if (movs === null) return <div className="flex justify-center py-6 text-kp-gray"><Spinner /></div>;
  if (movs.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-kp-gray">Todavía no hay movimientos registrados.</p>;
  }

  return (
    <ul className="divide-y divide-kp-border">
      {movs.map(m => {
        const esIngreso = m.tipo === 'ingreso';
        return (
          <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${
              esIngreso ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              {esIngreso ? '↓' : '↑'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-kp-white truncate">
                {m.concepto || ORIGEN_LABEL[m.origen_tipo ?? ''] || 'Movimiento'}
              </p>
              <p className="text-[10px] text-kp-gray truncate">
                {new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                {' '}{new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                {m.origen_tipo && <> · {ORIGEN_LABEL[m.origen_tipo] ?? m.origen_tipo}</>}
                {m.usuario_nombre && <> · {m.usuario_nombre}</>}
              </p>
            </div>
            <p className={`text-sm font-bold tabular-nums flex-shrink-0 ${esIngreso ? 'text-emerald-400' : 'text-rose-400'}`}>
              {esIngreso ? '+' : '−'}{fmt(m.monto)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CajaFuerteClient() {
  const [cajas, setCajas]     = useState<Caja[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState<Caja | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await apiFetch('/api/caja-fuerte');
      const data = await res.json();
      setCajas(data.cajas ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const total = cajas.reduce((a, c) => a + c.saldo, 0);

  return (
    <section className="space-y-5">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1 h-6 bg-kp-red rounded-full block" />
          <h2 className="text-2xl font-bold uppercase tracking-wide">Caja Fuerte</h2>
        </div>
        {cajas.length > 0 && (
          <span className="text-xs text-kp-gray">
            Total: <span className="text-kp-white font-bold">{fmt(total)}</span>
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-kp-gray"><Spinner /></div>
      ) : cajas.length === 0 ? (
        <div className="rounded-xl border border-kp-border bg-kp-surface p-12 text-center text-kp-gray text-sm">
          No hay sucursales activas.
        </div>
      ) : (
        <div className="space-y-4">
          {cajas.map(c => {
            const expandida = abierta === c.sucursal_id;
            return (
              <div key={c.sucursal_id} className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden">

                <div className="flex items-center gap-4 p-5 flex-wrap">
                  <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-500/10">
                    <span className="text-emerald-400"><IcoVault /></span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-kp-gray mb-1">
                      Caja fuerte · {c.sucursal_nombre}
                    </p>
                    <p className="text-2xl font-bold leading-none text-emerald-400 tabular-nums">{fmt(c.saldo)}</p>
                    {c.updated_at && (
                      <p className="text-[10px] text-kp-gray mt-1.5">
                        Últ. movimiento: {new Date(c.updated_at).toLocaleString('es-AR', {
                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>

                  {/* De qué se compone el saldo — el invariante, a la vista */}
                  <div className="text-right text-[11px] text-kp-gray tabular-nums leading-relaxed">
                    <p>Punto de partida <span className="text-kp-gray-lt">{fmt(c.saldo_inicial)}</span></p>
                    <p>Ingresos <span className="text-emerald-400">+{fmt(c.ingresos)}</span></p>
                    <p>Egresos <span className="text-rose-400">−{fmt(c.egresos)}</span></p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => setAbierta(expandida ? null : c.sucursal_id)}
                      className="px-3 py-2 rounded-lg border border-kp-border text-xs text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors">
                      {expandida ? 'Ocultar movimientos' : 'Ver movimientos'}
                    </button>
                    <button onClick={() => setModal(c)}
                      className="px-4 py-2 rounded-lg bg-kp-red text-white text-xs font-semibold hover:bg-kp-red/90 transition-colors">
                      Ajustar saldo
                    </button>
                  </div>
                </div>

                {expandida && (
                  <div className="border-t border-kp-border">
                    <Movimientos sucursalId={c.sucursal_id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal title={`Ajustar caja fuerte · ${modal.sucursal_nombre}`} onClose={() => setModal(null)}>
          <FormAjuste
            caja={modal}
            onGuardar={() => { setModal(null); cargar(); }}
            onCerrar={() => setModal(null)}
          />
        </Modal>
      )}

    </section>
  );
}
