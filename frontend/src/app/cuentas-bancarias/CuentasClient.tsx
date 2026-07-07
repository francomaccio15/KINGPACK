'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Cuenta {
  id: string;
  nombre: string;
  banco: string | null;
  titular: string | null;
  alias: string | null;
  cbu: string | null;
  activo: boolean;
  saldo: number;
}

const fmtMoneda = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

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

// ─── Modal genérico ───────────────────────────────────────────────────────────
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

// ─── Formulario de cuenta (crear / editar) ────────────────────────────────────
function FormCuenta({
  inicial, onGuardar, onCerrar,
}: {
  inicial?: Cuenta;
  onGuardar: () => void;
  onCerrar: () => void;
}) {
  const esEdicion = !!inicial;

  const [nombre,  setNombre]  = useState(inicial?.nombre  ?? '');
  const [banco,   setBanco]   = useState(inicial?.banco   ?? '');
  const [titular, setTitular] = useState(inicial?.titular ?? '');
  const [alias,   setAlias]   = useState(inicial?.alias   ?? '');
  const [cbu,     setCbu]     = useState(inicial?.cbu     ?? '');
  const [saldo,   setSaldo]   = useState(inicial?.saldo != null ? String(inicial.saldo) : '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const inputCls = 'w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';

  const handleSubmit = async () => {
    setError(null);
    if (!nombre.trim()) return setError('El nombre es requerido');
    setSaving(true);
    try {
      const body = {
        nombre:  nombre.trim(),
        banco:   banco.trim()   || null,
        titular: titular.trim() || null,
        alias:   alias.trim()   || null,
        cbu:     cbu.trim()     || null,
        saldo:   parseFloat(saldo) || 0,
      };
      const res  = await apiFetch(
        esEdicion ? `/api/cuentas-bancarias/${inicial!.id}` : '/api/cuentas-bancarias',
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
        <label className={labelCls}>Nombre *</label>
        <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Cuenta corriente principal" className={inputCls} autoFocus />
      </div>
      <div>
        <label className={labelCls}>Banco</label>
        <input type="text" value={banco} onChange={e => setBanco(e.target.value)}
          placeholder="Ej: Banco Macro" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Titular</label>
        <input type="text" value={titular} onChange={e => setTitular(e.target.value)}
          placeholder="Titular de la cuenta" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Alias</label>
        <input type="text" value={alias} onChange={e => setAlias(e.target.value)}
          placeholder="Alias de la cuenta" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>CBU</label>
        <input type="text" value={cbu} onChange={e => setCbu(e.target.value)}
          placeholder="CBU de la cuenta" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Saldo actual</label>
        <input type="number" step="0.01" value={saldo} onChange={e => setSaldo(e.target.value)}
          placeholder="0" className={inputCls} />
        <p className="text-[10px] text-kp-gray mt-1">Saldo de carga manual. Se muestra en el dashboard.</p>
      </div>
      {error &&<p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button onClick={onCerrar}
          className="flex-1 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors">
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50">
          {saving ? <><Spinner /> Guardando…</> : esEdicion ? 'Guardar cambios' : 'Crear cuenta'}
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CuentasClient() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalCrear,  setModalCrear]  = useState(false);
  const [modalEditar, setModalEditar] = useState<Cuenta | null>(null);
  const [togglingId,  setTogglingId]  = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await apiFetch('/api/cuentas-bancarias?activo=all');
      const data = await res.json();
      setCuentas(data.cuentas ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleActivo = async (c: Cuenta) => {
    setTogglingId(c.id);
    try {
      await apiFetch(`/api/cuentas-bancarias/${c.id}`, {
        method: 'PUT', body: JSON.stringify({ activo: !c.activo }),
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
          <h2 className="text-2xl font-bold uppercase tracking-wide">Cuentas Bancarias</h2>
          <span className="ml-2 text-xs font-semibold text-kp-gray bg-kp-surface2 border border-kp-border rounded-full px-2 py-0.5">
            {cuentas.length}
          </span>
        </div>
        <button
          onClick={() => setModalCrear(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva cuenta
        </button>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-20 text-kp-gray"><Spinner /></div>
      ) : cuentas.length === 0 ? (
        <div className="rounded-xl border border-kp-border bg-kp-surface p-12 text-center text-kp-gray text-sm">
          No hay cuentas bancarias cargadas todavía.
        </div>
      ) : (
        <div className="rounded-xl border border-kp-border overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-kp-surface2 border-b border-kp-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Banco</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">CBU / Alias</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Saldo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Activa</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {cuentas.map(c => (
                <tr key={c.id} className={`bg-kp-surface hover:bg-kp-surface2 transition-colors ${!c.activo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-kp-white">{c.nombre}</td>
                  <td className="px-4 py-3 text-xs text-kp-gray-lt">
                    {c.banco || '—'}
                    {c.titular && <span className="block text-kp-gray">{c.titular}</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-kp-gray">
                    {c.alias && <span className="block">{c.alias}</span>}
                    {c.cbu && <span className="block">{c.cbu}</span>}
                    {!c.alias && !c.cbu && '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-kp-white whitespace-nowrap">
                    {fmtMoneda(c.saldo ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActivo(c)}
                      disabled={togglingId === c.id}
                      title={c.activo ? 'Desactivar' : 'Activar'}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${c.activo ? 'bg-green-500' : 'bg-kp-border'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${c.activo ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setModalEditar(c)} title="Editar"
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
        <Modal title="Nueva cuenta bancaria" onClose={() => setModalCrear(false)}>
          <FormCuenta
            onGuardar={() => { setModalCrear(false); cargar(); }}
            onCerrar={() => setModalCrear(false)}
          />
        </Modal>
      )}

      {/* Modal Editar */}
      {modalEditar && (
        <Modal title="Editar cuenta bancaria" onClose={() => setModalEditar(null)}>
          <FormCuenta
            inicial={modalEditar}
            onGuardar={() => { setModalEditar(null); cargar(); }}
            onCerrar={() => setModalEditar(null)}
          />
        </Modal>
      )}

    </section>
  );
}
