'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStoredUser } from '@/lib/auth';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Transporte {
  id: string;
  razon_social: string;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
  created_at: string;
  saldo_inicial?: string | null;
  saldo_actual?: string | null;
}

interface Movimiento {
  id: string;
  tipo: 'pedido' | 'pago' | 'correccion';
  debe: string;
  haber: string;
  saldo: string;
  fecha: string;
  descripcion: string | null;
  medio_pago: string | null;
}

interface Totales {
  saldo_inicial: string;
  total_debe: string;
  total_haber: string;
  saldo_actual: string;
}

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

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (v: string | number | null) => { const n = parseFloat(String(v ?? '')); return isNaN(n) ? '—' : ars.format(n); };
const fmtFecha = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR'); };

// Rojo = le debemos, verde = a favor, gris = cero
const saldoCls = (v?: string | number | null) => {
  const n = parseFloat(String(v ?? '0'));
  return n > 0.005 ? 'text-kp-red' : n < -0.005 ? 'text-green-400' : 'text-kp-gray';
};

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function SaldoCell({ valor, onClick }: { valor?: string | null; onClick: () => void }) {
  const s = parseFloat(String(valor ?? ''));
  if (isNaN(s)) return <span className="text-kp-gray">—</span>;
  return (
    <button onClick={onClick} title="Ver movimientos"
      className={`tabular-nums font-semibold hover:underline ${saldoCls(valor)}`}>
      {fmt(valor ?? null)}
    </button>
  );
}

// ─── Modal genérico ───────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'} bg-kp-surface border border-kp-border rounded-2xl shadow-2xl max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border shrink-0">
          <h3 className="text-sm font-bold uppercase tracking-widest text-kp-white">{title}</h3>
          <button onClick={onClose} className="text-kp-gray hover:text-kp-white transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';

// ─── Formulario de transporte (crear / editar) ────────────────────────────────
function FormTransporte({ inicial, onGuardar, onCerrar }: { inicial?: Transporte; onGuardar: () => void; onCerrar: () => void }) {
  const esEdicion = !!inicial;

  const [razonSocial, setRazonSocial] = useState(inicial?.razon_social ?? '');
  const [cuit,        setCuit]        = useState(inicial?.cuit         ?? '');
  const [telefono,    setTelefono]    = useState(inicial?.telefono     ?? '');
  const [email,       setEmail]       = useState(inicial?.email        ?? '');
  const [direccion,   setDireccion]   = useState(inicial?.direccion    ?? '');
  const initNum = (v?: string | null) => (v != null && parseFloat(v) !== 0 ? String(parseFloat(v)) : '');
  const [saldoInicial, setSaldoInicial] = useState(initNum(inicial?.saldo_inicial));
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!razonSocial.trim()) return setError('La razón social es requerida');

    setSaving(true);
    try {
      const body = {
        razon_social: razonSocial.trim(),
        cuit:         cuit.trim() || null,
        telefono:     telefono.trim() || null,
        email:        email.trim() || null,
        direccion:    direccion.trim() || null,
        saldo_inicial: parseFloat(saldoInicial) || 0,
      };
      const res = await apiFetch(
        esEdicion ? `/api/transportes/${inicial!.id}` : '/api/transportes',
        { method: esEdicion ? 'PUT' : 'POST', body: JSON.stringify(body) }
      );
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
      <div>
        <label className={labelCls}>Razón Social *</label>
        <input type="text" value={razonSocial} onChange={e => setRazonSocial(e.target.value)}
          placeholder="Nombre del transporte" className={inputCls} autoFocus />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>CUIT</label>
          <input type="text" value={cuit} onChange={e => setCuit(e.target.value)} placeholder="30-12345678-9" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Teléfono</label>
          <input type="text" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="387 000-0000" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="transporte@ejemplo.com" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Dirección</label>
        <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle 123, Salta" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Saldo inicial (deuda previa al sistema)</label>
        <input type="number" step="0.01" value={saldoInicial} onChange={e => setSaldoInicial(e.target.value)} placeholder="0.00" className={inputCls} />
        <p className="mt-1 text-[11px] text-kp-gray/70">Positivo = ya le debías al transporte antes de empezar.</p>
      </div>

      {error && <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button onClick={onCerrar} className="flex-1 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors">
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50">
          {saving ? <><Spinner /> Guardando…</> : esEdicion ? 'Guardar cambios' : 'Crear transporte'}
        </button>
      </div>
    </div>
  );
}

// ─── Modal movimientos (historial de pedidos y pagos) ─────────────────────────
function ModalMovimientos({ transporte, esAdmin, onCambio, onCerrar }: {
  transporte: Transporte; esAdmin: boolean; onCambio: () => void; onCerrar: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [movs, setMovs]       = useState<Movimiento[]>([]);
  const [tot, setTot]         = useState<Totales | null>(null);

  // Form de nuevo movimiento
  const [tipo,   setTipo]   = useState<'pedido' | 'pago'>('pedido');
  const [monto,  setMonto]  = useState('');
  const [fecha,  setFecha]  = useState('');
  const [desc,   setDesc]   = useState('');
  const [medio,  setMedio]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await apiFetch(`/api/transportes/${transporte.id}/movimientos?limit=200`);
      const data = await res.json();
      setMovs(data.movimientos ?? []);
      setTot(data.totales ?? null);
    } finally {
      setLoading(false);
    }
  }, [transporte.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const agregar = async () => {
    setError(null);
    const m = parseFloat(monto);
    if (!(m > 0)) return setError('Ingresá un monto mayor a 0');
    setSaving(true);
    try {
      const res = await apiFetch(`/api/transportes/${transporte.id}/movimientos`, {
        method: 'POST',
        body: JSON.stringify({
          tipo,
          monto: m,
          fecha: fecha || null,
          descripcion: desc.trim() || null,
          medio_pago: tipo === 'pago' ? (medio.trim() || null) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? 'Error al guardar');
      setMonto(''); setDesc(''); setMedio(''); setFecha('');
      await cargar();
      onCambio();
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const borrar = async (movId: string) => {
    if (!confirm('¿Eliminar este movimiento?')) return;
    await apiFetch(`/api/transportes/${transporte.id}/movimientos/${movId}`, { method: 'DELETE' });
    await cargar();
    onCambio();
  };

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-kp-surface2 border border-kp-border rounded-lg px-4 py-3">
          <span className="block text-xs uppercase tracking-widest text-kp-gray">Pedidos (cargos)</span>
          <span className="text-base font-bold tabular-nums text-kp-white">{fmt(tot?.total_debe ?? '0')}</span>
        </div>
        <div className="bg-kp-surface2 border border-kp-border rounded-lg px-4 py-3">
          <span className="block text-xs uppercase tracking-widest text-kp-gray">Pagos</span>
          <span className="text-base font-bold tabular-nums text-kp-white">{fmt(tot?.total_haber ?? '0')}</span>
        </div>
        <div className="bg-kp-surface2 border border-kp-border rounded-lg px-4 py-3">
          <span className="block text-xs uppercase tracking-widest text-kp-gray">Saldo</span>
          <span className={`text-base font-bold tabular-nums ${saldoCls(tot?.saldo_actual)}`}>{fmt(tot?.saldo_actual ?? '0')}</span>
        </div>
      </div>

      {/* Alta de movimiento */}
      <div className="rounded-xl border border-kp-border bg-kp-surface2 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className={labelCls}>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as 'pedido' | 'pago')} className={inputCls}>
              <option value="pedido">Pedido (cargo)</option>
              <option value="pago">Pago</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Monto *</label>
            <input type="number" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{tipo === 'pago' ? 'Medio de pago' : '—'}</label>
            <input type="text" value={medio} onChange={e => setMedio(e.target.value)} disabled={tipo !== 'pago'}
              placeholder={tipo === 'pago' ? 'Efectivo, transf…' : ''} className={`${inputCls} disabled:opacity-40`} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Descripción</label>
          <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
            placeholder={tipo === 'pedido' ? 'Ej: Flete pedido #123, viaje a…' : 'Ej: Pago semana…'} className={inputCls} />
        </div>
        {error && <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>}
        <div className="flex justify-end">
          <button onClick={agregar} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50">
            {saving ? <><Spinner /> Guardando…</> : 'Agregar movimiento'}
          </button>
        </div>
      </div>

      {/* Historial */}
      {loading ? (
        <div className="flex justify-center py-10 text-kp-gray"><Spinner /></div>
      ) : movs.length === 0 ? (
        <p className="text-center py-10 text-sm text-kp-gray">Sin movimientos todavía.</p>
      ) : (
        <div className="rounded-xl border border-kp-border overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-kp-surface2 border-b border-kp-border">
                <th className="text-left px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Fecha</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Concepto</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Tipo</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Pedido</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Pago</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Saldo</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {movs.map(m => (
                <tr key={m.id} className="bg-kp-surface hover:bg-kp-surface2 transition-colors">
                  <td className="px-3 py-2 text-xs text-kp-gray whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                  <td className="px-3 py-2 text-xs text-kp-gray-lt">
                    {m.descripcion ?? '—'}
                    {m.medio_pago && <span className="text-kp-gray/60"> · {m.medio_pago}</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded border ${m.tipo === 'pago' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                      {m.tipo === 'pago' ? 'Pago' : 'Pedido'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{parseFloat(m.debe) ? fmt(m.debe) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{parseFloat(m.haber) ? fmt(m.haber) : '—'}</td>
                  <td className={`px-3 py-2 text-right tabular-nums text-xs font-semibold ${saldoCls(m.saldo)}`}>{fmt(m.saldo)}</td>
                  <td className="px-2 py-2 text-center">
                    {esAdmin && (
                      <button onClick={() => borrar(m.id)} title="Eliminar" className="text-kp-gray hover:text-kp-red transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button onClick={onCerrar} className="py-2 px-5 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white transition-colors">
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TransporteClient() {
  const [transportes, setTransportes] = useState<Transporte[]>([]);
  const [loading, setLoading]         = useState(true);
  const [q, setQ]                     = useState('');
  const [filtroActivo, setFiltroActivo] = useState<'' | 'true' | 'false'>('true');

  const [modalCrear,  setModalCrear]  = useState(false);
  const [modalEditar, setModalEditar] = useState<Transporte | null>(null);
  const [modalMov,    setModalMov]    = useState<Transporte | null>(null);
  const [togglingId,  setTogglingId]  = useState<string | null>(null);

  const esAdmin = getStoredUser()?.rol === 'administrador';

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '1000' });
      if (q.trim()) params.set('q', q.trim());
      params.set('activo', filtroActivo || 'all');
      const res  = await apiFetch(`/api/transportes?${params}`);
      const data = await res.json();
      setTransportes(data.transportes ?? []);
    } finally {
      setLoading(false);
    }
  }, [q, filtroActivo]);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleActivo = async (t: Transporte) => {
    setTogglingId(t.id);
    try {
      await apiFetch(`/api/transportes/${t.id}`, { method: 'PUT', body: JSON.stringify({ activo: !t.activo }) });
      await cargar();
    } finally {
      setTogglingId(null);
    }
  };

  const totalAdeudado = transportes.reduce((a, t) => {
    const s = parseFloat(String(t.saldo_actual ?? '0')) || 0;
    return a + (s > 0.005 ? s : 0);
  }, 0);
  const conDeuda = transportes.filter(t => (parseFloat(String(t.saldo_actual ?? '0')) || 0) > 0.005).length;

  return (
    <section className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1 h-6 bg-kp-red rounded-full block" />
          <h2 className="text-2xl font-bold uppercase tracking-wide">Transporte</h2>
          <span className="ml-2 text-xs font-semibold text-kp-gray bg-kp-surface2 border border-kp-border rounded-full px-2 py-0.5">
            {transportes.length}
          </span>
        </div>
        <button onClick={() => setModalCrear(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo transporte
        </button>
      </div>

      {/* Resumen deuda total */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-kp-red/10 border border-kp-red/30 rounded-xl px-4 py-3">
          <span className="block text-xs uppercase tracking-widest text-kp-gray">Total adeudado {conDeuda > 0 ? `· ${conDeuda} transp.` : ''}</span>
          <span className="text-lg font-bold tabular-nums text-kp-red">{fmt(totalAdeudado)}</span>
        </div>
        <div className="bg-kp-surface2 border border-kp-border rounded-xl px-4 py-3">
          <span className="block text-xs uppercase tracking-widest text-kp-gray">Transportes activos</span>
          <span className="text-lg font-bold tabular-nums text-kp-white">{transportes.filter(t => t.activo).length}</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kp-gray pointer-events-none">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="search" placeholder="Buscar por razón social o CUIT…" value={q} onChange={e => setQ(e.target.value)}
            className="w-full bg-kp-surface border border-kp-border rounded-lg pl-9 pr-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors" />
        </div>
        <select value={filtroActivo} onChange={e => setFiltroActivo(e.target.value as '' | 'true' | 'false')}
          className="bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors">
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
          <option value="">Todos</option>
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-20 text-kp-gray"><Spinner /></div>
      ) : transportes.length === 0 ? (
        <div className="rounded-xl border border-kp-border bg-kp-surface p-12 text-center text-kp-gray text-sm">
          No hay transportes{q ? ` que coincidan con "${q}"` : ''}.
        </div>
      ) : (
        <div className="rounded-xl border border-kp-border overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-kp-surface2 border-b border-kp-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Razón Social</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest whitespace-nowrap">CUIT</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Contacto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-kp-white uppercase tracking-widest whitespace-nowrap">Saldo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Activo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {transportes.map(t => (
                <tr key={t.id} className={`bg-kp-surface hover:bg-kp-surface2 transition-colors ${!t.activo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-kp-white">{t.razon_social}</td>
                  <td className="px-4 py-3 font-mono text-xs text-kp-gray whitespace-nowrap">{t.cuit || '—'}</td>
                  <td className="px-4 py-3 text-xs text-kp-gray-lt">
                    {t.telefono || t.email ? <>{t.telefono}{t.telefono && t.email ? ' · ' : ''}{t.email}</> : '—'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <SaldoCell valor={t.saldo_actual} onClick={() => setModalMov(t)} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActivo(t)} disabled={togglingId === t.id} title={t.activo ? 'Desactivar' : 'Activar'}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${t.activo ? 'bg-green-500' : 'bg-kp-border'}`}>
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${t.activo ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setModalMov(t)} title="Movimientos"
                        className="p-1.5 rounded-lg text-kp-gray hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                      </button>
                      <button onClick={() => setModalEditar(t)} title="Editar"
                        className="p-1.5 rounded-lg text-kp-gray hover:text-kp-white hover:bg-kp-surface2 transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Leyenda */}
      {!loading && transportes.length > 0 && (
        <p className="text-xs text-kp-gray flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-kp-red inline-block" /> Le debés al transporte</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Saldo a favor</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-kp-gray inline-block" /> Sin deuda</span>
          <span className="text-kp-gray/70">· Tocá un saldo para ver los movimientos.</span>
        </p>
      )}

      {/* Modales */}
      {modalCrear && (
        <Modal title="Nuevo transporte" onClose={() => setModalCrear(false)}>
          <FormTransporte onGuardar={() => { setModalCrear(false); cargar(); }} onCerrar={() => setModalCrear(false)} />
        </Modal>
      )}
      {modalEditar && (
        <Modal title="Editar transporte" onClose={() => setModalEditar(null)}>
          <FormTransporte inicial={modalEditar} onGuardar={() => { setModalEditar(null); cargar(); }} onCerrar={() => setModalEditar(null)} />
        </Modal>
      )}
      {modalMov && (
        <Modal title={`Movimientos — ${modalMov.razon_social}`} onClose={() => setModalMov(null)} wide>
          <ModalMovimientos transporte={modalMov} esAdmin={esAdmin} onCambio={cargar} onCerrar={() => setModalMov(null)} />
        </Modal>
      )}
    </section>
  );
}
