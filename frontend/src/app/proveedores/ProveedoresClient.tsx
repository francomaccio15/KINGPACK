'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Proveedor {
  id: string;
  razon_social: string;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  cond_pago: string | null;
  activo: boolean;
  created_at: string;
}

interface MovimientoCC {
  id: string;
  debe: string;
  haber: string;
  saldo: string;
  fecha: string;
  origen_tipo: string | null;
  descripcion: string | null;
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

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (v: string | number | null) => { const n = parseFloat(String(v ?? '')); return isNaN(n) ? '—' : ars.format(n); };
const fmtFecha = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR'); };

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Modal genérico ───────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} bg-kp-surface border border-kp-border rounded-2xl shadow-2xl max-h-[90vh] flex flex-col`}>
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

// ─── Formulario de proveedor (crear / editar) ─────────────────────────────────
function FormProveedor({
  inicial, onGuardar, onCerrar,
}: {
  inicial?: Proveedor;
  onGuardar: () => void;
  onCerrar: () => void;
}) {
  const esEdicion = !!inicial;

  const [razonSocial, setRazonSocial] = useState(inicial?.razon_social ?? '');
  const [cuit,        setCuit]        = useState(inicial?.cuit         ?? '');
  const [telefono,    setTelefono]    = useState(inicial?.telefono     ?? '');
  const [email,       setEmail]       = useState(inicial?.email        ?? '');
  const [direccion,   setDireccion]   = useState(inicial?.direccion    ?? '');
  const [condPago,    setCondPago]    = useState(inicial?.cond_pago    ?? '');
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const inputCls = 'w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';

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
        cond_pago:    condPago.trim() || null,
      };

      const res = await apiFetch(
        esEdicion ? `/api/proveedores/${inicial!.id}` : '/api/proveedores',
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
          placeholder="Nombre o razón social" className={inputCls} autoFocus />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>CUIT</label>
          <input type="text" value={cuit} onChange={e => setCuit(e.target.value)}
            placeholder="30-12345678-9" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Teléfono</label>
          <input type="text" value={telefono} onChange={e => setTelefono(e.target.value)}
            placeholder="387 000-0000" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="proveedor@ejemplo.com" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Dirección</label>
        <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)}
          placeholder="Calle 123, Salta" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Condición de Pago</label>
        <input type="text" value={condPago} onChange={e => setCondPago(e.target.value)}
          placeholder="Ej: Contado, 30 días, etc." className={inputCls} />
      </div>

      {error && (
        <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={onCerrar}
          className="flex-1 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors">
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50">
          {saving ? <><Spinner /> Guardando…</> : esEdicion ? 'Guardar cambios' : 'Crear proveedor'}
        </button>
      </div>
    </div>
  );
}

// ─── Modal cuenta corriente ───────────────────────────────────────────────────
function ModalCuentaCorriente({ proveedor, onCerrar }: { proveedor: Proveedor; onCerrar: () => void }) {
  const [loading, setLoading]   = useState(true);
  const [movs, setMovs]         = useState<MovimientoCC[]>([]);
  const [saldo, setSaldo]       = useState<string>('0');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res  = await apiFetch(`/api/proveedores/${proveedor.id}/cuenta-corriente?limit=100`);
        const data = await res.json();
        setMovs(data.movimientos ?? []);
        setSaldo(data.totales?.saldo_actual ?? '0');
      } finally {
        setLoading(false);
      }
    })();
  }, [proveedor.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-kp-surface2 border border-kp-border rounded-lg px-4 py-3">
        <span className="text-xs uppercase tracking-widest text-kp-gray">Saldo actual</span>
        <span className={`text-lg font-bold tabular-nums ${parseFloat(saldo) > 0 ? 'text-kp-red' : parseFloat(saldo) < 0 ? 'text-green-400' : 'text-kp-gray'}`}>
          {fmt(saldo)}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-kp-gray"><Spinner /></div>
      ) : movs.length === 0 ? (
        <p className="text-center py-10 text-sm text-kp-gray">Sin movimientos en la cuenta corriente.</p>
      ) : (
        <div className="rounded-xl border border-kp-border overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-kp-surface2 border-b border-kp-border">
                <th className="text-left px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Fecha</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Concepto</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Debe</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Haber</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-kp-gray uppercase tracking-widest">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {movs.map(m => (
                <tr key={m.id} className="bg-kp-surface hover:bg-kp-surface2 transition-colors">
                  <td className="px-3 py-2 text-xs text-kp-gray whitespace-nowrap">{fmtFecha(m.fecha)}</td>
                  <td className="px-3 py-2 text-xs text-kp-gray-lt">{m.descripcion ?? m.origen_tipo ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{parseFloat(m.debe) ? fmt(m.debe) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{parseFloat(m.haber) ? fmt(m.haber) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-semibold">{fmt(m.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end pt-1">
        <button onClick={onCerrar}
          className="py-2 px-5 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white transition-colors">
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ProveedoresClient() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [q,           setQ]           = useState('');
  const [filtroActivo, setFiltroActivo] = useState<'' | 'true' | 'false'>('true');

  const [modalCrear,  setModalCrear]  = useState(false);
  const [modalEditar, setModalEditar] = useState<Proveedor | null>(null);
  const [modalCC,     setModalCC]     = useState<Proveedor | null>(null);
  const [togglingId,  setTogglingId]  = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (q.trim())     params.set('q', q.trim());
      params.set('activo', filtroActivo || 'all');

      const res  = await apiFetch(`/api/proveedores?${params}`);
      const data = await res.json();
      setProveedores(data.proveedores ?? []);
    } finally {
      setLoading(false);
    }
  }, [q, filtroActivo]);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleActivo = async (p: Proveedor) => {
    setTogglingId(p.id);
    try {
      await apiFetch(`/api/proveedores/${p.id}`, {
        method: 'PUT', body: JSON.stringify({ activo: !p.activo }),
      });
      await cargar();
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <section className="space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1 h-6 bg-kp-red rounded-full block" />
          <h2 className="text-2xl font-bold uppercase tracking-wide">Proveedores</h2>
          <span className="ml-2 text-xs font-semibold text-kp-gray bg-kp-surface2 border border-kp-border rounded-full px-2 py-0.5">
            {proveedores.length}
          </span>
        </div>
        <button
          onClick={() => setModalCrear(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo proveedor
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kp-gray pointer-events-none">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por razón social o CUIT…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full bg-kp-surface border border-kp-border rounded-lg pl-9 pr-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors"
          />
        </div>
        <select
          value={filtroActivo}
          onChange={e => setFiltroActivo(e.target.value as '' | 'true' | 'false')}
          className="bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors"
        >
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
          <option value="">Todos</option>
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-20 text-kp-gray"><Spinner /></div>
      ) : proveedores.length === 0 ? (
        <div className="rounded-xl border border-kp-border bg-kp-surface p-12 text-center text-kp-gray text-sm">
          No hay proveedores{q ? ` que coincidan con "${q}"` : ''}.
        </div>
      ) : (
        <div className="rounded-xl border border-kp-border overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-kp-surface2 border-b border-kp-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Razón Social</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest whitespace-nowrap">CUIT</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Contacto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Cond. Pago</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Activo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {proveedores.map(p => (
                <tr key={p.id} className={`bg-kp-surface hover:bg-kp-surface2 transition-colors ${!p.activo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-kp-white">{p.razon_social}</td>
                  <td className="px-4 py-3 font-mono text-xs text-kp-gray whitespace-nowrap">{p.cuit || '—'}</td>
                  <td className="px-4 py-3 text-xs text-kp-gray-lt">
                    {p.telefono || p.email
                      ? <>{p.telefono}{p.telefono && p.email ? ' · ' : ''}{p.email}</>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-kp-gray-lt">{p.cond_pago || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActivo(p)}
                      disabled={togglingId === p.id}
                      title={p.activo ? 'Desactivar' : 'Activar'}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${p.activo ? 'bg-green-500' : 'bg-kp-border'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${p.activo ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Cuenta corriente */}
                      <button onClick={() => setModalCC(p)} title="Cuenta corriente"
                        className="p-1.5 rounded-lg text-kp-gray hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                      </button>
                      {/* Editar */}
                      <button onClick={() => setModalEditar(p)} title="Editar"
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

      {/* Modal Crear */}
      {modalCrear && (
        <Modal title="Nuevo proveedor" onClose={() => setModalCrear(false)}>
          <FormProveedor
            onGuardar={() => { setModalCrear(false); cargar(); }}
            onCerrar={() => setModalCrear(false)}
          />
        </Modal>
      )}

      {/* Modal Editar */}
      {modalEditar && (
        <Modal title="Editar proveedor" onClose={() => setModalEditar(null)}>
          <FormProveedor
            inicial={modalEditar}
            onGuardar={() => { setModalEditar(null); cargar(); }}
            onCerrar={() => setModalEditar(null)}
          />
        </Modal>
      )}

      {/* Modal Cuenta Corriente */}
      {modalCC && (
        <Modal title={`Cuenta corriente — ${modalCC.razon_social}`} onClose={() => setModalCC(null)} wide>
          <ModalCuentaCorriente proveedor={modalCC} onCerrar={() => setModalCC(null)} />
        </Modal>
      )}

    </section>
  );
}
