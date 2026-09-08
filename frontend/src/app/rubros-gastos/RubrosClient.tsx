'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Subrubro { id: string; nombre: string; rubro_id: string | null; total?: number; cantidad?: number; }
interface Rubro    {
  id: string; nombre: string; orden: number; subrubros: Subrubro[];
  total?: number; cantidad?: number;
  categoria_resultado_id?: string | null;
  categoria_nombre?: string | null;
  categoria_seccion?: string | null;
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

// Sucursal activa (cookie que setea el toggle TODAS/HUAICO/LAPRIDA). '' = todas.
const sucursalActiva = () => {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|;\s*)kp_sucursal_id=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
};

const fmtMoneda = (n: number) =>
  '$ ' + Math.round(n).toLocaleString('es-AR');

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Período mensual → rango de fechas [1° … último día del mes]
const rangoDelMes = (anio: number, mes: number) => {
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const ultimo = new Date(anio, mes, 0).getDate();
  const hasta = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
  return { desde, hasta };
};

// Link al Estado de Resultados (modo mensual), anclado en la categoría (#cat-<id>).
const hrefEstadoResultados = (anio: number, mes: number, categoriaId: string) => {
  const qs = new URLSearchParams({ tab: 'er', anio: String(anio), mes: String(mes) });
  return `/reportes?${qs.toString()}#cat-${categoriaId}`;
};

// Link al listado de egresos filtrado por subrubro y el mismo período mensual.
const hrefEgresosSubrubro = (subrubroId: string, desde: string, hasta: string) => {
  const qs = new URLSearchParams({ subrubro_gasto_id: subrubroId, fecha_desde: desde, fecha_hasta: hasta });
  return `/gastos?${qs.toString()}`;
};

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}


// ─── Formulario simple de nombre ──────────────────────────────────────────────
function FormNombre({
  label, placeholder, accion, onGuardar, onCerrar, extraOrden,
  inicialNombre, inicialOrden, textoBoton,
}: {
  label: string;
  placeholder: string;
  accion: (nombre: string, orden: number) => Promise<Response>;
  onGuardar: () => void;
  onCerrar: () => void;
  extraOrden?: boolean;
  inicialNombre?: string;
  inicialOrden?: number;
  textoBoton?: string;
}) {
  const [nombre, setNombre] = useState(inicialNombre ?? '');
  const [orden,  setOrden]  = useState(inicialOrden != null ? String(inicialOrden) : '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const inputCls = 'w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
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
          {saving ? <><Spinner /> Guardando…</> : (textoBoton ?? 'Guardar')}
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
  const [editRubro,     setEditRubro]     = useState<Rubro | null>(null);
  const [editSubrubro,  setEditSubrubro]  = useState<Subrubro | null>(null);

  const ahora = new Date();
  const [anio,         setAnio]         = useState(ahora.getFullYear());
  const [mes,          setMes]          = useState(ahora.getMonth() + 1);
  const [totalGeneral, setTotalGeneral] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { desde, hasta } = rangoDelMes(anio, mes);
      const qs = new URLSearchParams({ desde, hasta });
      const suc = sucursalActiva();
      if (suc) qs.set('sucursal_id', suc);
      const res  = await apiFetch(`/api/rubros-gastos?${qs.toString()}`);
      const data = await res.json();
      setRubros(data.rubros ?? []);
      setTotalGeneral(typeof data.total_general === 'number' ? data.total_general : null);
    } finally {
      setLoading(false);
    }
  }, [anio, mes]);

  useEffect(() => { cargar(); }, [cargar]);

  // Navegación relativa entre meses (normaliza el rollover de año)
  const irRelativo = (delta: number) => {
    const base = new Date(anio, mes - 1 + delta, 1);
    setAnio(base.getFullYear());
    setMes(base.getMonth() + 1);
  };
  const esFuturo = anio > ahora.getFullYear() || (anio === ahora.getFullYear() && mes >= ahora.getMonth() + 1);
  const anios: number[] = [];
  for (let a = ahora.getFullYear(); a >= 2024; a--) anios.push(a);

  const totalSub = rubros.reduce((acc, r) => acc + r.subrubros.length, 0);

  const selPeriodo = 'bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors [color-scheme:dark]';
  const btnNav = 'px-2.5 py-2 rounded-lg bg-kp-surface2 border border-kp-border text-kp-gray text-sm font-semibold hover:text-kp-white hover:border-kp-red/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <section className="space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 md:h-6 bg-kp-red rounded-full block shrink-0" />
          <h2 className="text-lg md:text-2xl font-bold uppercase tracking-wide">Rubros de Egresos</h2>
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

      {/* Selector de período mensual + total del mes */}
      <div className="flex items-center justify-between flex-wrap gap-3 rounded-xl border border-kp-border bg-kp-surface px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-widest text-kp-gray mr-1">Período</span>
          <button type="button" onClick={() => irRelativo(-1)} title="Mes anterior" className={btnNav}>◀</button>
          <select value={mes} onChange={e => setMes(parseInt(e.target.value, 10))} className={selPeriodo}>
            {MESES.map((nombre, i) => <option key={i} value={i + 1}>{nombre}</option>)}
          </select>
          <select value={anio} onChange={e => setAnio(parseInt(e.target.value, 10))} className={selPeriodo}>
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button type="button" onClick={() => irRelativo(1)} disabled={esFuturo} title="Mes siguiente" className={btnNav}>▶</button>
          <button
            type="button"
            onClick={() => { setAnio(ahora.getFullYear()); setMes(ahora.getMonth() + 1); }}
            className="px-3 py-2 rounded-lg bg-kp-surface2 border border-kp-border text-kp-gray text-xs font-semibold hover:text-kp-white hover:border-kp-red/50 transition-colors">
            Mes actual
          </button>
        </div>
        {totalGeneral != null && (
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-widest text-kp-gray">Total {MESES[mes - 1]} {anio}</p>
            <p className="text-xl font-bold text-kp-white tabular-nums">{fmtMoneda(totalGeneral)}</p>
          </div>
        )}
      </div>

      {/* Listado */}
      {loading ? (
        <div className="flex justify-center py-20 text-kp-gray"><Spinner /></div>
      ) : rubros.length === 0 ? (
        <div className="rounded-xl border border-kp-border bg-kp-surface p-12 text-center text-kp-gray text-sm">
          No hay rubros de egresos cargados todavía.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rubros.map(r => (
            <div key={r.id} className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 bg-kp-surface2 border-b border-kp-border">
                <div className="min-w-0">
                  <h3 className="font-semibold text-kp-white text-sm truncate">{r.nombre}</h3>
                  {r.total != null && (
                    <p className="text-base font-bold text-kp-red tabular-nums">{fmtMoneda(r.total)}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditRubro(r)} title="Editar rubro"
                    className="p-1.5 rounded-lg text-kp-gray hover:text-kp-white hover:bg-kp-border/40 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button onClick={() => setModalSubrubro(r)} title="Agregar subrubro"
                    className="p-1.5 rounded-lg text-kp-gray hover:text-kp-red hover:bg-kp-red/10 transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-4 flex-1">
                {r.subrubros.length === 0 ? (
                  <p className="text-xs text-kp-gray italic">Sin subrubros.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {r.subrubros.map(s => {
                      const { desde, hasta } = rangoDelMes(anio, mes);
                      return (
                      <li key={s.id} className="group flex items-center gap-1 text-sm text-kp-gray-lt">
                        <Link
                          href={hrefEgresosSubrubro(s.id, desde, hasta)}
                          title={`Ver egresos de "${s.nombre}"`}
                          className="flex-1 min-w-0 flex items-center gap-2 -mx-1 px-1 py-0.5 rounded hover:bg-kp-surface2 hover:text-kp-white transition-colors">
                          <span className="w-1 h-1 rounded-full bg-kp-red shrink-0" />
                          <span className="flex-1 truncate">{s.nombre}</span>
                          {s.total != null && (
                            <span className={`tabular-nums text-xs shrink-0 ${s.total > 0 ? 'text-kp-white font-medium' : 'text-kp-gray'}`}>
                              {fmtMoneda(s.total)}
                            </span>
                          )}
                        </Link>
                        <button onClick={() => setEditSubrubro(s)} title="Editar subrubro"
                          className="p-1 rounded text-kp-gray opacity-0 group-hover:opacity-100 hover:text-kp-white transition-all shrink-0">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {r.categoria_resultado_id && r.categoria_seccion !== 'excluido' && (
                <Link
                  href={hrefEstadoResultados(anio, mes, r.categoria_resultado_id)}
                  title={`Ver "${r.categoria_nombre}" en el Estado de Resultados`}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-kp-border bg-kp-surface2/40 text-xs font-semibold text-kp-gray hover:text-kp-red hover:bg-kp-surface2 transition-colors">
                  <span className="truncate">
                    Ver en Estado de Resultados
                    {r.categoria_nombre && <span className="text-kp-gray/60"> · {r.categoria_nombre}</span>}
                  </span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                    <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                  </svg>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Nuevo rubro */}
      {modalRubro && (
        <Modal open title="Nuevo rubro" onClose={() => setModalRubro(false)}>
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
        <Modal open title={`Nuevo subrubro — ${modalSubrubro.nombre}`} onClose={() => setModalSubrubro(null)}>
          <FormNombre
            label="Nombre del subrubro"
            placeholder="Ej: Luz, Agua, Combustible…"
            accion={(nombre) => apiFetch(`/api/rubros-gastos/${modalSubrubro.id}/subrubros`, { method: 'POST', body: JSON.stringify({ nombre }) })}
            onGuardar={() => { setModalSubrubro(null); cargar(); }}
            onCerrar={() => setModalSubrubro(null)}
          />
        </Modal>
      )}

      {/* Modal Editar rubro */}
      {editRubro && (
        <Modal open title="Editar rubro" onClose={() => setEditRubro(null)}>
          <FormNombre
            label="Nombre del rubro"
            placeholder="Ej: Servicios, Impuestos, Logística…"
            extraOrden
            inicialNombre={editRubro.nombre}
            inicialOrden={editRubro.orden}
            textoBoton="Guardar cambios"
            accion={(nombre, orden) => apiFetch(`/api/rubros-gastos/${editRubro.id}`, { method: 'PUT', body: JSON.stringify({ nombre, orden }) })}
            onGuardar={() => { setEditRubro(null); cargar(); }}
            onCerrar={() => setEditRubro(null)}
          />
        </Modal>
      )}

      {/* Modal Editar subrubro */}
      {editSubrubro && (
        <Modal open title="Editar subrubro" onClose={() => setEditSubrubro(null)}>
          <FormNombre
            label="Nombre del subrubro"
            placeholder="Ej: Luz, Agua, Combustible…"
            inicialNombre={editSubrubro.nombre}
            textoBoton="Guardar cambios"
            accion={(nombre) => apiFetch(`/api/rubros-gastos/subrubros/${editSubrubro.id}`, { method: 'PUT', body: JSON.stringify({ nombre }) })}
            onGuardar={() => { setEditSubrubro(null); cargar(); }}
            onCerrar={() => setEditSubrubro(null)}
          />
        </Modal>
      )}

    </section>
  );
}
