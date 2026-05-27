'use client';

import { useState, useRef, useEffect } from 'react';
import type { Categoria } from './page';
import { useAuth } from '@/contexts/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, {
    ...o,
    headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
  });
};

// ─── Íconos ───────────────────────────────────────────────────────────────────
const IcoPlus  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>;
const IcoEdit  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcoCheck = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoX     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoTrash = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;

// ─── Modal Nueva Categoría ────────────────────────────────────────────────────
function NuevaCategoria({ onCreated, onClose }: { onCreated: (c: Categoria) => void; onClose: () => void }) {
  const [nombre,  setNombre]  = useState('');
  const [margen,  setMargen]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true); setError('');
    try {
      const r = await apiFetch('/api/categorias', {
        method: 'POST',
        body: JSON.stringify({ nombre, margen_default: parseFloat(margen) || 0 }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || `Error ${r.status}`); return; }
      onCreated(data.categoria);
      onClose();
    } catch { setError('No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const inputCls = 'w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-kp-surface rounded-2xl border border-kp-border shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border bg-kp-surface2 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="w-1 h-6 bg-kp-red rounded-full" />
            <h2 className="text-sm font-bold uppercase tracking-wide">Nueva Categoría</h2>
          </div>
          <button onClick={onClose} className="text-kp-gray hover:text-kp-white text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-kp-gray mb-1">Nombre *</label>
            <input
              ref={inputRef}
              value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Ej: BOLSAS CAMISETAS"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-kp-gray mb-1">
              Margen por defecto (%)
            </label>
            <div className="relative">
              <input
                type="number" min="0" max="200" step="0.5"
                value={margen} onChange={e => setMargen(e.target.value)}
                placeholder="Ej: 40"
                className={inputCls + ' pr-8'}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-gray text-sm">%</span>
            </div>
            <p className="text-[10px] text-kp-gray mt-1">
              Se aplica automáticamente a los artículos de esta categoría.
            </p>
          </div>

          {error && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/80 disabled:opacity-50 transition-colors">
              {saving ? 'Guardando…' : 'Crear categoría'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Fila editable ────────────────────────────────────────────────────────────
function CategoriaRow({
  cat, isAdmin,
  onSave, onDelete, onToggle,
}: {
  cat: Categoria;
  isAdmin: boolean;
  onSave:   (id: string, nombre: string, margen: number) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  onToggle: (id: string, activo: boolean) => Promise<void>;
}) {
  const [editing,    setEditing]    = useState(false);
  const [nombre,     setNombre]     = useState(cat.nombre);
  const [margen,     setMargen]     = useState(String(cat.margen_default));
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const startEdit = () => {
    setNombre(cat.nombre);
    setMargen(String(cat.margen_default));
    setError('');
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setError(''); };

  const handleSave = async () => {
    if (!nombre.trim()) { setError('El nombre no puede estar vacío'); return; }
    setSaving(true); setError('');
    const err = await onSave(cat.id, nombre, parseFloat(margen) || 0);
    if (err) setError(err);
    else setEditing(false);
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    const err = await onDelete(cat.id);
    if (err) { setError(err); setConfirmDel(false); }
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') cancelEdit();
  };

  return (
    <tr className={`group transition-colors ${cat.activo ? 'hover:bg-kp-surface2' : 'opacity-50 hover:bg-kp-surface2'}`}>

      {/* Nombre */}
      <td className="px-4 py-3">
        {editing ? (
          <input
            ref={inputRef}
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-kp-surface2 border border-kp-red rounded-md px-2.5 py-1.5 text-sm text-kp-white outline-none"
          />
        ) : (
          <span className="text-sm font-medium text-kp-white">{cat.nombre}</span>
        )}
        {error && !editing && <p className="text-[10px] text-rose-400 mt-0.5">{error}</p>}
      </td>

      {/* Margen */}
      <td className="px-4 py-3 w-36">
        {editing ? (
          <div className="relative w-24">
            <input
              type="number" min="0" max="200" step="0.5"
              value={margen}
              onChange={e => setMargen(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-kp-surface2 border border-kp-red rounded-md px-2.5 py-1.5 text-sm text-kp-white outline-none pr-6 tabular-nums"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-kp-gray text-xs">%</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-bold tabular-nums ${cat.margen_default > 0 ? 'text-green-400' : 'text-kp-gray'}`}>
              {cat.margen_default > 0 ? `+${cat.margen_default.toFixed(1)}%` : '—'}
            </span>
          </div>
        )}
      </td>

      {/* Artículos */}
      <td className="px-4 py-3 w-28 text-center">
        <span className={`inline-flex items-center justify-center text-xs font-semibold px-2.5 py-0.5 rounded-full
          ${cat.articulos_count > 0
            ? 'bg-kp-surface2 border border-kp-border text-kp-gray-lt'
            : 'text-kp-border'}`}>
          {cat.articulos_count > 0 ? cat.articulos_count : '—'}
        </span>
      </td>

      {/* Estado */}
      <td className="px-4 py-3 w-28 text-center">
        {isAdmin ? (
          <button
            onClick={() => onToggle(cat.id, !cat.activo)}
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors
              ${cat.activo
                ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400'
                : 'bg-kp-border/20 border-kp-border/40 text-kp-gray hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400'}`}
            title={cat.activo ? 'Click para desactivar' : 'Click para activar'}
          >
            <span className={`w-1 h-1 rounded-full ${cat.activo ? 'bg-green-400' : 'bg-kp-gray'}`} />
            {cat.activo ? 'Activa' : 'Inactiva'}
          </button>
        ) : (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border
            ${cat.activo ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-kp-border/20 border-kp-border/40 text-kp-gray'}`}>
            <span className={`w-1 h-1 rounded-full ${cat.activo ? 'bg-green-400' : 'bg-kp-gray'}`} />
            {cat.activo ? 'Activa' : 'Inactiva'}
          </span>
        )}
      </td>

      {/* Acciones */}
      <td className="px-3 py-3 w-24 text-right">
        {isAdmin && (
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {editing ? (
              <>
                <button onClick={handleSave} disabled={saving}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-50"
                  title="Guardar">
                  {saving ? <span className="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin" /> : <IcoCheck />}
                </button>
                <button onClick={cancelEdit}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-kp-gray hover:text-kp-white hover:bg-kp-surface2 transition-colors"
                  title="Cancelar">
                  <IcoX />
                </button>
              </>
            ) : (
              <>
                <button onClick={startEdit}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-kp-gray hover:text-kp-white hover:bg-kp-surface2 transition-colors"
                  title="Editar">
                  <IcoEdit />
                </button>
                {cat.articulos_count === 0 && (
                  confirmDel ? (
                    <div className="flex items-center gap-1 ml-1">
                      <button onClick={handleDelete} disabled={saving}
                        className="text-[10px] font-bold text-rose-400 hover:underline">
                        {saving ? '…' : 'Eliminar'}
                      </button>
                      <span className="text-kp-border text-[10px]">/</span>
                      <button onClick={() => setConfirmDel(false)}
                        className="text-[10px] font-bold text-kp-gray hover:underline">
                        No
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDel(true)}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-kp-gray hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Eliminar">
                      <IcoTrash />
                    </button>
                  )
                )}
              </>
            )}
            {error && editing && (
              <span className="text-[10px] text-rose-400 ml-1">{error}</span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CategoriasView({ categoriasIniciales }: { categoriasIniciales: Categoria[] }) {
  const { user }   = useAuth();
  const isAdmin    = user?.rol === 'administrador';

  const [cats,       setCats]       = useState<Categoria[]>(categoriasIniciales);
  const [showForm,   setShowForm]   = useState(false);
  const [q,          setQ]          = useState('');
  const [filtroActivo, setFiltroActivo] = useState<'all' | 'true' | 'false'>('true');

  const filtered = cats.filter(c => {
    if (filtroActivo !== 'all' && c.activo !== (filtroActivo === 'true')) return false;
    if (q && !c.nombre.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const totalArticulos = cats.filter(c => c.activo).reduce((s, c) => s + c.articulos_count, 0);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCreated = (c: Categoria) => setCats(prev => [...prev, c].sort((a, b) => a.nombre.localeCompare(b.nombre)));

  const handleSave = async (id: string, nombre: string, margen: number): Promise<string | null> => {
    try {
      const r = await apiFetch(`/api/categorias/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ nombre, margen_default: margen }),
      });
      const data = await r.json();
      if (!r.ok) return data.error || `Error ${r.status}`;
      setCats(prev => prev.map(c => c.id === id ? data.categoria : c));
      return null;
    } catch { return 'Error de conexión'; }
  };

  const handleDelete = async (id: string): Promise<string | null> => {
    try {
      const r = await apiFetch(`/api/categorias/${id}`, { method: 'DELETE' });
      const data = await r.json();
      if (!r.ok) return data.error || `Error ${r.status}`;
      setCats(prev => prev.filter(c => c.id !== id));
      return null;
    } catch { return 'Error de conexión'; }
  };

  const handleToggle = async (id: string, activo: boolean) => {
    // Optimista
    setCats(prev => prev.map(c => c.id === id ? { ...c, activo } : c));
    try {
      const r = await apiFetch(`/api/categorias/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activo }),
      });
      if (!r.ok) {
        // Revertir
        setCats(prev => prev.map(c => c.id === id ? { ...c, activo: !activo } : c));
      }
    } catch {
      setCats(prev => prev.map(c => c.id === id ? { ...c, activo: !activo } : c));
    }
  };

  return (
    <section className="space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1 h-6 bg-kp-red rounded-full block" />
            <h2 className="text-2xl font-bold uppercase tracking-wide">Categorías</h2>
          </div>
          <div className="flex items-center gap-3 pl-3 flex-wrap">
            <p className="text-sm text-kp-gray">
              {filtered.length} {filtered.length === 1 ? 'categoría' : 'categorías'}
            </p>
            <span className="text-xs bg-kp-surface2 border border-kp-border rounded px-2 py-0.5 text-kp-gray">
              {totalArticulos} artículos en total
            </span>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/80 transition-colors"
          >
            <IcoPlus /> Nueva categoría
          </button>
        )}
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Buscar categoría..."
            className="w-full bg-kp-surface border border-kp-border rounded-lg pl-9 pr-4 py-2 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
          />
          {q && (
            <button onClick={() => setQ('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-gray hover:text-kp-white text-xs">✕</button>
          )}
        </div>
        <div className="flex rounded-lg overflow-hidden border border-kp-border text-xs font-semibold">
          {(['true', 'all', 'false'] as const).map(val => {
            const labels = { true: 'Activas', all: 'Todas', false: 'Inactivas' };
            return (
              <button key={val} onClick={() => setFiltroActivo(val)}
                className={`px-3 py-2 transition-colors ${filtroActivo === val ? 'bg-kp-red text-white' : 'bg-kp-surface text-kp-gray hover:text-kp-white'}`}>
                {labels[val]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="overflow-x-auto rounded-xl border border-kp-border shadow-lg shadow-black/40">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border">
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold">Nombre</th>
              <th className="text-left px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold w-36">Margen default</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold w-28">Artículos</th>
              <th className="text-center px-4 py-3 text-kp-gray uppercase tracking-widest text-xs font-semibold w-28">Estado</th>
              <th className="px-3 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="bg-kp-surface divide-y divide-kp-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-kp-gray">
                  {q ? 'No se encontraron categorías con ese nombre.' : 'No hay categorías para mostrar.'}
                </td>
              </tr>
            ) : (
              filtered.map(cat => (
                <CategoriaRow
                  key={cat.id}
                  cat={cat}
                  isAdmin={isAdmin}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info margen */}
      {isAdmin && (
        <p className="text-[11px] text-kp-gray px-1">
          💡 Al editar el margen, se actualiza automáticamente en todos los artículos de esa categoría.
        </p>
      )}

      {/* Modal */}
      {showForm && (
        <NuevaCategoria
          onCreated={handleCreated}
          onClose={() => setShowForm(false)}
        />
      )}
    </section>
  );
}
