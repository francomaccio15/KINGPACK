'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import { useSucursalActiva } from '@/lib/sucursalActivaCliente';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Caja {
  saldo:         number;
  saldo_inicial: number;
  updated_at:    string | null;
  ingresos:      number;
  egresos:       number;
}

interface AporteSucursal {
  sucursal_id:      string;
  sucursal_nombre:  string;
  cierres:          number;
  cantidad_cierres: number;
}

interface Movimiento {
  id:              string;
  fecha:           string;
  created_at:      string;
  tipo:            'ingreso' | 'egreso';
  monto:           number;
  concepto:        string | null;
  origen_tipo:     string | null;
  origen_id:       string | null;
  sucursal_nombre: string | null;
  usuario_nombre:  string | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n);

const ORIGEN_LABEL: Record<string, string> = {
  cierre_caja:    'Cierre de caja',
  egreso:         'Egreso',
  pago_proveedor: 'Pago a proveedor',
};

// A dónde lleva cada movimiento para ver el comprobante que lo originó.
const origenHref = (m: Movimiento): string | null => {
  if (!m.origen_id) return null;
  if (m.origen_tipo === 'cierre_caja') return `/caja/${m.origen_id}`;
  if (m.origen_tipo === 'egreso')      return `/gastos/${m.origen_id}`;
  return null;
};

const PAGINA = 50;

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

const IcoCaja = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    <path d="M12 12v4M10 14h4" />
  </svg>
);

const inputCls = 'w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';

// ─── Formulario de ajuste ─────────────────────────────────────────────────────
function FormAjuste({ caja, onGuardar, onCerrar }: { caja: Caja; onGuardar: () => void; onCerrar: () => void }) {
  const [valor, setValor]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const nuevo = parseFloat(valor);
  const valido = Number.isFinite(nuevo) && nuevo >= 0;
  const diferencia = valido ? nuevo - caja.saldo : 0;

  const handleSubmit = async () => {
    setError(null);
    if (!valido) return setError('Ingresá un monto válido (no puede ser negativo)');
    setSaving(true);
    try {
      const res  = await apiFetch('/api/caja-administrativa', {
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
        <p className="text-2xs md:text-[11px] uppercase tracking-widest text-kp-gray">Saldo actual del sistema</p>
        <p className="text-xl font-bold tabular-nums text-kp-white mt-0.5">{fmt(caja.saldo)}</p>
      </div>

      <div>
        <label className={labelCls}>Efectivo realmente contado *</label>
        <input type="number" step="0.01" min="0" value={valor} onChange={e => setValor(e.target.value)}
          placeholder="0.00" className={inputCls} autoFocus />
        <p className="text-2xs md:text-[10px] text-kp-gray mt-1">
          Pasa a ser el punto de partida. Los cierres de caja y los pagos con Caja Administrativa
          que se registren de acá en adelante se van a sumar y restar sobre este número.
        </p>
      </div>

      {valido && diferencia !== 0 && (
        <div className={`rounded-lg border px-4 py-3 ${diferencia > 0 ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
          <p className="text-2xs md:text-[11px] uppercase tracking-widest text-kp-gray">Diferencia</p>
          <p className={`text-lg font-bold tabular-nums ${diferencia > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {diferencia > 0 ? '+' : '−'}{fmt(Math.abs(diferencia))}
          </p>
          <p className="text-2xs md:text-[10px] text-kp-gray mt-1">
            No se registra como movimiento: es una corrección del punto de partida. El historial queda intacto.
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

// ─── Historial ────────────────────────────────────────────────────────────────
function Historial({ sucursales, recarga }: { sucursales: AporteSucursal[]; recarga: number }) {
  const sucursalActiva = useSucursalActiva();
  const [sucursalId, setSucursalId] = useState('');
  const [tipo, setTipo]             = useState('');
  const [desde, setDesde]           = useState('');
  const [hasta, setHasta]           = useState('');
  const [movs, setMovs]             = useState<Movimiento[]>([]);
  const [count, setCount]           = useState(0);
  const [loading, setLoading]       = useState(true);

  // El filtro de sucursal sigue al selector del header ("Todas" = sin filtro).
  useEffect(() => { setSucursalId(sucursalActiva); }, [sucursalActiva]);

  const cargar = useCallback(async (offset: number) => {
    setLoading(true);
    const q = new URLSearchParams({ limit: String(PAGINA), offset: String(offset) });
    if (sucursalId) q.set('sucursal_id', sucursalId);
    if (tipo)       q.set('tipo', tipo);
    if (desde)      q.set('fecha_desde', desde);
    if (hasta)      q.set('fecha_hasta', hasta);
    try {
      const res  = await apiFetch(`/api/caja-administrativa/movimientos?${q}`);
      const data = await res.json();
      const nuevos: Movimiento[] = data.movimientos ?? [];
      setMovs(prev => offset === 0 ? nuevos : [...prev, ...nuevos]);
      setCount(data.count ?? 0);
    } catch {
      if (offset === 0) setMovs([]);
    } finally {
      setLoading(false);
    }
  }, [sucursalId, tipo, desde, hasta]);

  useEffect(() => { cargar(0); }, [cargar, recarga]);

  return (
    <div className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden">
      <div className="p-4 border-b border-kp-border space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-kp-gray">Historial de movimientos</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Sucursal</label>
            <select value={sucursalId} onChange={e => setSucursalId(e.target.value)} className={inputCls}>
              <option value="">Todas</option>
              {sucursales.map(s => <option key={s.sucursal_id} value={s.sucursal_id}>{s.sucursal_nombre}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="egreso">Egresos</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {loading && movs.length === 0 ? (
        <div className="flex justify-center py-8 text-kp-gray"><Spinner /></div>
      ) : movs.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-kp-gray">No hay movimientos para mostrar.</p>
      ) : (
        <>
          <ul className="divide-y divide-kp-border">
            {movs.map(m => {
              const esIngreso = m.tipo === 'ingreso';
              const href = origenHref(m);
              const titulo = m.concepto || ORIGEN_LABEL[m.origen_tipo ?? ''] || 'Movimiento';
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    esIngreso ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {esIngreso ? '↓' : '↑'}
                  </div>
                  <div className="min-w-0 flex-1">
                    {href ? (
                      <Link href={href} className="block text-xs font-semibold text-kp-white truncate hover:underline">{titulo}</Link>
                    ) : (
                      <p className="text-xs font-semibold text-kp-white truncate">{titulo}</p>
                    )}
                    <p className="text-2xs md:text-[10px] text-kp-gray truncate">
                      {new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      {' '}{new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      {m.origen_tipo && <> · {ORIGEN_LABEL[m.origen_tipo] ?? m.origen_tipo}</>}
                      {m.sucursal_nombre && <> · {m.sucursal_nombre}</>}
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
          {movs.length < count && (
            <div className="p-3 border-t border-kp-border flex justify-center">
              <button onClick={() => cargar(movs.length)} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-kp-border text-xs text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors disabled:opacity-50">
                {loading ? <Spinner /> : null} Ver más ({count - movs.length} restantes)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CajaAdministrativaClient() {
  const [caja, setCaja]             = useState<Caja | null>(null);
  const [sucursales, setSucursales] = useState<AporteSucursal[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [recarga, setRecarga]       = useState(0);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await apiFetch('/api/caja-administrativa');
      const data = await res.json();
      setCaja(data.caja ?? null);
      setSucursales(data.por_sucursal ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <section className="space-y-5">

      <div className="flex items-center gap-2">
        <span className="w-1 h-5 md:h-6 bg-kp-red rounded-full block shrink-0" />
        <h2 className="text-lg md:text-2xl font-bold uppercase tracking-wide">Caja Administrativa</h2>
      </div>

      {loading && !caja ? (
        <div className="flex justify-center py-20 text-kp-gray"><Spinner /></div>
      ) : caja && (
        <div className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden">
          <div className="flex items-center gap-4 p-5 flex-wrap">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-500/10">
              <span className="text-emerald-400"><IcoCaja /></span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xs md:text-[11px] font-bold uppercase tracking-widest text-kp-gray mb-1">Saldo en efectivo</p>
              <p className={`text-2xl font-bold leading-none tabular-nums ${caja.saldo < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{fmt(caja.saldo)}</p>
              {caja.updated_at && (
                <p className="text-2xs md:text-[10px] text-kp-gray mt-1.5">
                  Últ. movimiento: {new Date(caja.updated_at).toLocaleString('es-AR', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            {/* De qué se compone el saldo — el invariante, a la vista */}
            <div className="text-right text-2xs md:text-[11px] text-kp-gray tabular-nums leading-relaxed">
              <p>Punto de partida <span className="text-kp-gray-lt">{fmt(caja.saldo_inicial)}</span></p>
              <p>Ingresos <span className="text-emerald-400">+{fmt(caja.ingresos)}</span></p>
              <p>Egresos <span className="text-rose-400">−{fmt(caja.egresos)}</span></p>
            </div>

            <button onClick={() => setModal(true)}
              className="px-4 py-2 rounded-lg bg-kp-red text-white text-xs font-semibold hover:bg-kp-red/90 transition-colors">
              Ajustar saldo
            </button>
          </div>

          {/* Cuánto aportó cada caja diaria con sus cierres */}
          {sucursales.length > 0 && (
            <div className="border-t border-kp-border grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-kp-border">
              {sucursales.map(s => (
                <div key={s.sucursal_id} className="px-5 py-3">
                  <p className="text-2xs md:text-[11px] uppercase tracking-widest text-kp-gray">Cierres de caja · {s.sucursal_nombre}</p>
                  <p className="text-base font-bold tabular-nums text-kp-white mt-0.5">{fmt(s.cierres)}</p>
                  <p className="text-2xs md:text-[10px] text-kp-gray">
                    {s.cantidad_cierres} {s.cantidad_cierres === 1 ? 'cierre' : 'cierres'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-kp-gray">
        Al cerrar la caja diaria de cada sucursal, el efectivo contado entra acá. Se usa como medio de pago
        «Caja Administrativa» al registrar egresos y pagos a proveedor.
      </p>

      <Historial sucursales={sucursales} recarga={recarga} />

      {modal && caja && (
        <Modal open title="Ajustar Caja Administrativa" onClose={() => setModal(false)}>
          <FormAjuste
            caja={caja}
            onGuardar={() => { setModal(false); cargar(); setRecarga(r => r + 1); }}
            onCerrar={() => setModal(false)}
          />
        </Modal>
      )}

    </section>
  );
}
