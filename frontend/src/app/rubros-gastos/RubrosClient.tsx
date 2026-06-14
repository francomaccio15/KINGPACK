'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Subrubro { id: string; nombre: string; rubro_id: string | null; }
interface Rubro    { id: string; nombre: string; orden: number; subrubros: Subrubro[]; }

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

// ─── Formulario simple de nombre ──────────────────────────────────────────────
function FormNombre({
  label, placeholder, accion, onGuardar, onCerrar, extraOrden,
}: {
  label: string;
  placeholder: string;
  accion: (nombre: string, orden: number) => Promise<Response>;
  onGuardar: () => void;
  onCerrar: () => void;
  extraOrden?: boolean;
}) {
  const [nombre, setNombre] = useState('');
  const [orden,  setOrden]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const inputCls = 'w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';

  const handleSubmit = async () => {
    setError(null);
    if (!nombre.trim()) return setError('El nombre es requerido');
    setSaving(true);
    try {
      const res  = await accion(nombre.trim(), parseInt(orden) || 0);
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
        <label className={labelCls}>{label} *</label>
        <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder={placeholder} className={inputCls} autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }} />
      </div>
      {extraOrden && (
        <div>
          <label className={labelCls}>Orden</label>
          <input type="number" value={orden} onChange={e => setOrden(e.target.value)}
            placeholder="0" className={inputCls} />
        </div>
      )}
      {error && <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button onClick={onCerrar}
          className="flex-1 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors">
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50">
          {saving ? <><Spinner /> Guardando…</> : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function RubrosClient() {
  const [rubros,  setRubros]  = useState<Rubro[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalRubro,    setModalRubro]    = useState(false);
  const [modalSubrubro, setModalSubrubro] = useState<Rubro | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await apiFetch('/api/rubros-gastos');
      const data = await res.json();
      setRubros(data.rubros ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const totalSub = rubros.reduce((acc, r) => acc + r.subrubros.length, 0);

  return (
    <section className="space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1 h-6 bg-kp-red rounded-full block" />
          <h2 className="text-2xl font-bold uppercase tracking-wide">Rubros de Gastos</h2>
          <span className="ml-2 text-xs font-semibold text-kp-gray bg-kp-surface2 border border-kp-border rounded-full px-2 py-0.5">
            {rubros.length} rubros · {totalSub} subrubros
          </span>
        </div>
        <button
          onClick={() => setModalRubro(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo rubro
        </button>
      </div>

      {/* Listado */}
      {loading ? (
        <div className="flex justify-center py-20 text-kp-gray"><Spinner /></div>
      ) : rubros.length === 0 ? (
        <div className="rounded-xl border border-kp-border bg-kp-surface p-12 text-center text-kp-gray text-sm">
          No hay rubros de gastos cargados todavía.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rubros.map(r => (
            <div key={r.id} className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 bg-kp-surface2 border-b border-kp-border">
                <h3 className="font-semibold text-kp-white text-sm">{r.nombre}</h3>
                <button onClick={() => setModalSubrubro(r)} title="Agregar subrubro"
                  className="p-1.5 rounded-lg text-kp-gray hover:text-kp-red hover:bg-kp-red/10 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 flex-1">
                {r.subrubros.length === 0 ? (
                  <p className="text-xs text-kp-gray italic">Sin subrubros.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {r.subrubros.map(s => (
                      <li key={s.id} className="flex items-center gap-2 text-sm text-kp-gray-lt">
                        <span className="w-1 h-1 rounded-full bg-kp-red shrink-0" />
                        {s.nombre}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nuevo rubro */}
      {modalRubro && (
        <Modal title="Nuevo rubro" onClose={() => setModalRubro(false)}>
          <FormNombre
            label="Nombre del rubro"
            placeholder="Ej: Servicios, Impuestos, Logística…"
            extraOrden
            accion={(nombre, orden) => apiFetch('/api/rubros-gastos', { method: 'POST', body: JSON.stringify({ nombre, orden }) })}
            onGuardar={() => { setModalRubro(false); cargar(); }}
            onCerrar={() => setModalRubro(false)}
          />
        </Modal>
      )}

      {/* Modal Nuevo subrubro */}
      {modalSubrubro && (
        <Modal title={`Nuevo subrubro — ${modalSubrubro.nombre}`} onClose={() => setModalSubrubro(null)}>
          <FormNombre
            label="Nombre del subrubro"
            placeholder="Ej: Luz, Agua, Combustible…"
            accion={(nombre) => apiFetch(`/api/rubros-gastos/${modalSubrubro.id}/subrubros`, { method: 'POST', body: JSON.stringify({ nombre }) })}
            onGuardar={() => { setModalSubrubro(null); cargar(); }}
            onCerrar={() => setModalSubrubro(null)}
          />
        </Modal>
      )}

    </section>
  );
}
