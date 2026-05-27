'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────
export type Nota = {
  id: string;
  contenido: string;
  tipo: 'general' | 'pendiente' | 'pedido' | 'aviso';
  resuelta: boolean;
  usuario_id: string;
  autor: string;
  autor_rol: string;
  created_at: string;
  updated_at: string;
};

type FiltroEstado = 'todas' | 'pendientes' | 'resueltas';
type FiltroTipo   = 'all' | 'general' | 'pendiente' | 'pedido' | 'aviso';

// ─── Config por tipo ──────────────────────────────────────────────────────────
const TIPO_CONFIG = {
  general:   { label: 'General',   color: 'text-slate-400',   bg: 'bg-slate-500/10',  border: 'border-slate-500/20',  dot: 'bg-slate-400' },
  pendiente: { label: 'Pendiente', color: 'text-amber-400',   bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  dot: 'bg-amber-400' },
  pedido:    { label: 'Pedido',    color: 'text-sky-400',     bg: 'bg-sky-500/10',    border: 'border-sky-500/25',    dot: 'bg-sky-400' },
  aviso:     { label: 'Aviso',     color: 'text-rose-400',    bg: 'bg-rose-500/10',   border: 'border-rose-500/25',   dot: 'bg-rose-400' },
} as const;

// ─── API helper ───────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
function apiFetch(path: string, opts: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers as Record<string, string> || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function tiempoRelativo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)      return 'hace un momento';
  if (diff < 3600)    return `hace ${Math.floor(diff / 60)}min`;
  if (diff < 86400)   return `hace ${Math.floor(diff / 3600)}h`;
  if (diff < 604800)  return `hace ${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ─── Íconos ───────────────────────────────────────────────────────────────────
const IcoCheck  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12" /></svg>;
const IcoEdit   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcoTrash  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const IcoPlus   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcoUndo   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg>;

// ─── Componente principal ─────────────────────────────────────────────────────
export default function NotasView({
  notasIniciales, rol, userId,
}: {
  notasIniciales: Nota[];
  rol: string;
  userId: string;
}) {
  const router = useRouter();
  const esAdmin = rol === 'administrador';

  const [notas, setNotas]               = useState<Nota[]>(notasIniciales);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('pendientes');
  const [filtroTipo, setFiltroTipo]     = useState<FiltroTipo>('all');
  const [showForm, setShowForm]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [formErr, setFormErr]           = useState('');
  const [form, setForm]                 = useState({ contenido: '', tipo: 'general' as Nota['tipo'] });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // editando: { id, contenido, tipo }
  const [editando, setEditando] = useState<{ id: string; contenido: string; tipo: Nota['tipo'] } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState<string | null>(null); // id a confirmar

  // Auto-focus al abrir form
  useEffect(() => {
    if (showForm) setTimeout(() => textareaRef.current?.focus(), 80);
  }, [showForm]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const notasFiltradas = notas.filter(n => {
    if (filtroEstado === 'pendientes' && n.resuelta)   return false;
    if (filtroEstado === 'resueltas'  && !n.resuelta)  return false;
    if (filtroTipo !== 'all' && n.tipo !== filtroTipo) return false;
    return true;
  });

  const countPendientes = notas.filter(n => !n.resuelta).length;

  // ── Crear nota ────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.contenido.trim()) { setFormErr('Escribí el contenido de la nota'); return; }
    setSaving(true); setFormErr('');
    try {
      const r = await apiFetch('/api/notas', {
        method: 'POST',
        body: JSON.stringify({ contenido: form.contenido, tipo: form.tipo }),
      });
      const data = await r.json();
      if (!r.ok) { setFormErr(data.error || 'Error al guardar'); return; }
      setNotas(prev => [data.nota, ...prev]);
      setForm({ contenido: '', tipo: 'general' });
      setShowForm(false);
      setFiltroEstado('pendientes');
    } catch { setFormErr('No se pudo conectar con el servidor'); }
    finally { setSaving(false); }
  };

  // ── Resolver / abrir ──────────────────────────────────────────────────────
  const handleResolver = async (id: string, resuelta: boolean) => {
    setNotas(prev => prev.map(n => n.id === id ? { ...n, resuelta } : n));
    try {
      await apiFetch(`/api/notas/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ resuelta }),
      });
    } catch {
      // revert optimistic
      setNotas(prev => prev.map(n => n.id === id ? { ...n, resuelta: !resuelta } : n));
    }
  };

  // ── Editar (admin) ────────────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!editando) return;
    if (!editando.contenido.trim()) return;
    setEditSaving(true);
    try {
      const r = await apiFetch(`/api/notas/${editando.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ contenido: editando.contenido, tipo: editando.tipo }),
      });
      const data = await r.json();
      if (r.ok) {
        setNotas(prev => prev.map(n => n.id === data.nota.id ? data.nota : n));
        setEditando(null);
      }
    } finally { setEditSaving(false); }
  };

  // ── Eliminar (admin) ──────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDelConfirm(null);
    setNotas(prev => prev.filter(n => n.id !== id));
    try {
      await apiFetch(`/api/notas/${id}`, { method: 'DELETE' });
    } catch {
      // Si falla, refrescar del servidor
      router.refresh();
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <section className="space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Notas de equipo</h2>
          </div>
          <p className="text-sm text-kp-gray pl-3">
            {countPendientes > 0
              ? <><span className="text-amber-400 font-semibold">{countPendientes}</span> {countPendientes === 1 ? 'nota pendiente' : 'notas pendientes'}</>
              : 'Sin notas pendientes'}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setFormErr(''); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/80 transition-colors"
        >
          <IcoPlus />
          Nueva nota
        </button>
      </div>

      {/* ── Formulario nueva nota ── */}
      {showForm && (
        <div className="rounded-xl border border-kp-red/30 bg-kp-surface p-5 space-y-4 shadow-lg shadow-black/30">
          <p className="text-xs font-bold uppercase tracking-widest text-kp-gray">Nueva nota</p>

          {/* Tipo */}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(TIPO_CONFIG) as [Nota['tipo'], typeof TIPO_CONFIG[keyof typeof TIPO_CONFIG]][]).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setForm(f => ({ ...f, tipo: key }))}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors',
                  form.tipo === key
                    ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                    : 'bg-kp-surface2 border-kp-border text-kp-gray hover:text-kp-white',
                ].join(' ')}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={form.contenido}
            onChange={e => { setForm(f => ({ ...f, contenido: e.target.value })); setFormErr(''); }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCreate(); }}
            rows={3}
            placeholder="Escribí la nota... (Ctrl+Enter para guardar)"
            className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-4 py-3 text-sm text-kp-white placeholder:text-kp-gray resize-none focus:outline-none focus:border-kp-red transition-colors"
          />

          {formErr && <p className="text-xs text-rose-400">{formErr}</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/80 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar nota'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ contenido: '', tipo: 'general' }); setFormErr(''); }}
              className="px-4 py-2 rounded-lg border border-kp-border text-kp-gray hover:text-kp-white text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Estado */}
        <div className="flex rounded-lg overflow-hidden border border-kp-border text-xs font-semibold">
          {(['pendientes', 'todas', 'resueltas'] as FiltroEstado[]).map(v => {
            const labels = { pendientes: 'Pendientes', todas: 'Todas', resueltas: 'Resueltas' };
            return (
              <button
                key={v}
                onClick={() => setFiltroEstado(v)}
                className={`px-3 py-2 transition-colors ${
                  filtroEstado === v ? 'bg-kp-red text-white' : 'bg-kp-surface text-kp-gray hover:text-kp-white'
                }`}
              >
                {labels[v]}
              </button>
            );
          })}
        </div>

        {/* Tipo */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFiltroTipo('all')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
              filtroTipo === 'all'
                ? 'bg-kp-surface2 border-kp-border text-kp-white'
                : 'bg-kp-surface border-kp-border text-kp-gray hover:text-kp-white'
            }`}
          >
            Todos los tipos
          </button>
          {(Object.entries(TIPO_CONFIG) as [Nota['tipo'], typeof TIPO_CONFIG[keyof typeof TIPO_CONFIG]][]).map(([key, cfg]) => {
            const count = notas.filter(n => n.tipo === key && !n.resuelta).length;
            return (
              <button
                key={key}
                onClick={() => setFiltroTipo(key)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors',
                  filtroTipo === key
                    ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                    : 'bg-kp-surface border-kp-border text-kp-gray hover:text-kp-white',
                ].join(' ')}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
                {count > 0 && (
                  <span className={`text-[9px] font-bold px-1 rounded ${cfg.bg} ${cfg.color}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Grid de notas ── */}
      {notasFiltradas.length === 0 ? (
        <div className="rounded-xl border border-kp-border bg-kp-surface p-12 text-center">
          <p className="text-kp-gray text-sm">
            {filtroEstado === 'pendientes' ? 'No hay notas pendientes 🎉' : 'No hay notas que coincidan con el filtro.'}
          </p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-0">
          {notasFiltradas.map(nota => {
            const cfg = TIPO_CONFIG[nota.tipo];
            const editandoEsta = editando?.id === nota.id;

            return (
              <div
                key={nota.id}
                className={[
                  'break-inside-avoid mb-4 rounded-xl border bg-kp-surface transition-all',
                  nota.resuelta ? 'opacity-55 border-kp-border/50' : cfg.border,
                ].join(' ')}
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${cfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                    {nota.resuelta && <span className="text-emerald-400 ml-1">· Resuelto</span>}
                  </span>

                  {/* Acciones admin */}
                  {esAdmin && !editandoEsta && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditando({ id: nota.id, contenido: nota.contenido, tipo: nota.tipo })}
                        className="p-1.5 rounded text-kp-gray hover:text-kp-white hover:bg-kp-surface2 transition-colors"
                        title="Editar"
                      >
                        <IcoEdit />
                      </button>
                      {delConfirm === nota.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(nota.id)}
                            className="px-2 py-1 rounded text-[10px] font-bold text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            Eliminar
                          </button>
                          <button
                            onClick={() => setDelConfirm(null)}
                            className="px-2 py-1 rounded text-[10px] font-bold text-kp-gray hover:text-kp-white transition-colors"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setDelConfirm(nota.id)}
                          className="p-1.5 rounded text-kp-gray hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Eliminar"
                        >
                          <IcoTrash />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Contenido — modo edición */}
                {editandoEsta ? (
                  <div className="px-4 pb-3 space-y-3">
                    {/* Tipo selector en edición */}
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.entries(TIPO_CONFIG) as [Nota['tipo'], typeof TIPO_CONFIG[keyof typeof TIPO_CONFIG]][]).map(([key, c]) => (
                        <button
                          key={key}
                          onClick={() => setEditando(e => e ? { ...e, tipo: key } : e)}
                          className={[
                            'flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-semibold transition-colors',
                            editando.tipo === key ? `${c.bg} ${c.border} ${c.color}` : 'bg-kp-surface2 border-kp-border text-kp-gray',
                          ].join(' ')}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                          {c.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={editando.contenido}
                      onChange={e => setEditando(ed => ed ? { ...ed, contenido: e.target.value } : ed)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleEdit(); }}
                      rows={3}
                      autoFocus
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white resize-none focus:outline-none focus:border-kp-red transition-colors"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleEdit}
                        disabled={editSaving}
                        className="px-3 py-1.5 rounded bg-kp-red text-white text-xs font-semibold hover:bg-kp-red/80 transition-colors disabled:opacity-50"
                      >
                        {editSaving ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        className="px-3 py-1.5 rounded border border-kp-border text-kp-gray hover:text-kp-white text-xs transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Contenido normal */
                  <p className={`px-4 pb-3 text-sm leading-relaxed whitespace-pre-wrap ${nota.resuelta ? 'text-kp-gray line-through' : 'text-kp-white'}`}>
                    {nota.contenido}
                  </p>
                )}

                {/* Card footer */}
                {!editandoEsta && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-kp-border/60">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-kp-gray capitalize">{nota.autor}</span>
                      <span className="text-[10px] text-kp-gray/70">{tiempoRelativo(nota.created_at)}</span>
                    </div>
                    {/* Botón resolver/abrir */}
                    <button
                      onClick={() => handleResolver(nota.id, !nota.resuelta)}
                      className={[
                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all',
                        nota.resuelta
                          ? 'border-kp-border text-kp-gray hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/5'
                          : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15',
                      ].join(' ')}
                      title={nota.resuelta ? 'Marcar como pendiente' : 'Marcar como resuelto'}
                    >
                      {nota.resuelta ? <><IcoUndo /> Reabrir</> : <><IcoCheck /> Resolver</>}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
