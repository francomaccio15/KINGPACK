'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Categoria } from './page';
import { useAuth } from '@/contexts/AuthContext';
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

// ─── Íconos ───────────────────────────────────────────────────────────────────
const IcoPlus   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M12 5v14M5 12h14"/></svg>;
const IcoEdit   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcoTrash  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const IcoCheck  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoX      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoSearch = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
const IcoChev   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 transition-transform duration-200"><path d="M6 9l6 6 6-6"/></svg>;
const IcoBox    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 opacity-40"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 2 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
const IcoList   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const IcoClose  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

// ─── Color por inicial de categoría ──────────────────────────────────────────
const PALETTE = [
  'from-violet-500/20 to-violet-500/5 border-violet-500/30',
  'from-sky-500/20 to-sky-500/5 border-sky-500/30',
  'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
  'from-amber-500/20 to-amber-500/5 border-amber-500/30',
  'from-rose-500/20 to-rose-500/5 border-rose-500/30',
  'from-indigo-500/20 to-indigo-500/5 border-indigo-500/30',
  'from-teal-500/20 to-teal-500/5 border-teal-500/30',
  'from-orange-500/20 to-orange-500/5 border-orange-500/30',
];
const LETTER_COLORS = [
  'bg-violet-500/20 text-violet-300',
  'bg-sky-500/20 text-sky-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-amber-500/20 text-amber-300',
  'bg-rose-500/20 text-rose-300',
  'bg-indigo-500/20 text-indigo-300',
  'bg-teal-500/20 text-teal-300',
  'bg-orange-500/20 text-orange-300',
];
function paletteIdx(nombre: string) {
  return nombre.charCodeAt(0) % PALETTE.length;
}

// ─── Buscador desplegable (Combobox) ─────────────────────────────────────────
function BuscadorDesplegable({
  categorias,
  seleccionada,
  onSelect,
}: {
  categorias: Categoria[];
  seleccionada: string;
  onSelect: (id: string) => void;
}) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const opciones = categorias.filter(c =>
    !query.trim() || c.nombre.toLowerCase().includes(query.toLowerCase())
  );
  const selObj = categorias.find(c => c.id === seleccionada);

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={wrapRef} className="relative w-72">
      {/* Trigger */}
      <button
        onClick={open ? () => { setOpen(false); setQuery(''); } : handleOpen}
        className={[
          'w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors text-left',
          open
            ? 'bg-kp-surface2 border-kp-red text-kp-white'
            : 'bg-kp-surface border-kp-border text-kp-gray hover:border-kp-border/60 hover:text-kp-white',
        ].join(' ')}
      >
        <IcoSearch />
        <span className={`flex-1 truncate ${selObj ? 'text-kp-white font-medium' : ''}`}>
          {selObj ? selObj.nombre : 'Buscar categoría…'}
        </span>
        {selObj && (
          <span
            onClick={e => { e.stopPropagation(); onSelect(''); }}
            className="text-kp-gray hover:text-kp-white text-base leading-none"
          >×</span>
        )}
        <span className={open ? 'rotate-180' : ''}><IcoChev /></span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-kp-surface border border-kp-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
          {/* Input de búsqueda dentro del dropdown */}
          <div className="p-2 border-b border-kp-border">
            <div className="relative">
              <IcoSearch />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Escribí para filtrar…"
                className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-kp-gray">
                <IcoSearch />
              </span>
            </div>
          </div>

          {/* Opción "Todas" */}
          <button
            onClick={() => handleSelect('')}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left border-b border-kp-border/40
              ${!seleccionada ? 'bg-kp-red/10 text-kp-red font-semibold' : 'text-kp-gray hover:bg-kp-surface2 hover:text-kp-white'}`}
          >
            Todas las categorías
            <span className="ml-auto text-[10px] text-kp-gray">{categorias.length}</span>
          </button>

          {/* Lista filtrada */}
          <div className="max-h-60 overflow-y-auto">
            {opciones.length === 0 ? (
              <p className="px-3 py-4 text-sm text-kp-gray text-center">Sin resultados</p>
            ) : (
              opciones.map(c => {
                const idx = paletteIdx(c.nombre);
                const isSelected = c.id === seleccionada;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(c.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors
                      ${isSelected
                        ? 'bg-kp-red/10 text-kp-red'
                        : 'hover:bg-kp-surface2 text-kp-gray-lt hover:text-kp-white'}`}
                  >
                    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0 ${LETTER_COLORS[idx]}`}>
                      {c.nombre[0]}
                    </span>
                    <span className="flex-1 truncate font-medium">{c.nombre}</span>
                    <span className="text-[10px] text-kp-gray tabular-nums flex-shrink-0">
                      {c.articulos_count} art.
                    </span>
                    {isSelected && <IcoCheck />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal Nueva / Editar Categoría ──────────────────────────────────────────
function FormCategoria({
  inicial,
  onSave,
  onClose,
}: {
  inicial?: Categoria;
  onSave: (nombre: string, margen: number) => Promise<string | null>;
  onClose: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [margen, setMargen] = useState(inicial ? String(inicial.margen_default) : '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true); setError('');
    const err = await onSave(nombre, parseFloat(margen) || 0);
    if (err) { setError(err); setSaving(false); }
    else onClose();
  };

  const inputCls = 'w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const esEdicion = !!inicial;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-kp-surface rounded-2xl border border-kp-border shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border bg-kp-surface2 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="w-1 h-6 bg-kp-red rounded-full" />
            <h2 className="text-sm font-bold uppercase tracking-wide">
              {esEdicion ? 'Editar categoría' : 'Nueva categoría'}
            </h2>
          </div>
          <button onClick={onClose} className="text-kp-gray hover:text-kp-white text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-kp-gray mb-1.5">Nombre *</label>
            <input ref={inputRef} value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Ej: BOLSAS CAMISETAS" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-kp-gray mb-1.5">Margen por defecto (%)</label>
            <div className="relative">
              <NumericInput
                value={margen} onChange={e => setMargen(e.target.value)}
                placeholder="Ej: 40" className={inputCls + ' pr-8'} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-kp-gray text-sm font-bold">%</span>
            </div>
            {esEdicion && (
              <p className="text-[10px] text-amber-400 mt-1.5">
                ⚠ Cambiar el margen actualiza automáticamente todos los artículos de esta categoría.
              </p>
            )}
          </div>
          {error && (
            <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/80 disabled:opacity-50 transition-colors">
              {saving ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear categoría'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tipo artículo simplificado para panel de categoría ──────────────────────
type ArticuloCat = {
  id: string;
  codigo: string;
  nombre: string;
  precio_madre: string;
  margen_aplicado: string | null;
  stock_total: string;
  activo: boolean;
};

// ─── Tarjeta de categoría ─────────────────────────────────────────────────────
function CategoriaCard({
  cat, isAdmin, highlighted, expandida,
  onSave, onDelete, onToggle, onExpand,
}: {
  cat: Categoria;
  isAdmin: boolean;
  highlighted: boolean;
  expandida: boolean;
  onSave:   (id: string, nombre: string, margen: number) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  onToggle: (id: string, activo: boolean) => Promise<void>;
  onExpand: (id: string | null) => void;
}) {
  const [editando,   setEditando]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [delError,   setDelError]   = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  const idx = paletteIdx(cat.nombre);

  // Scroll al resaltar
  useEffect(() => {
    if (highlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  const handleDelete = async () => {
    setDeleting(true); setDelError('');
    const err = await onDelete(cat.id);
    if (err) { setDelError(err); setConfirmDel(false); }
    setDeleting(false);
  };

  const handleSave = async (nombre: string, margen: number) => {
    const err = await onSave(cat.id, nombre, margen);
    return err;
  };

  return (
    <>
      <div
        ref={cardRef}
        className={[
          'relative group rounded-2xl border bg-gradient-to-br transition-all duration-200',
          PALETTE[idx],
          cat.activo ? '' : 'opacity-50 grayscale',
          highlighted ? 'ring-2 ring-kp-red ring-offset-2 ring-offset-kp-bg scale-[1.02]' : 'hover:scale-[1.01]',
          expandida ? 'ring-2 ring-kp-red/60 ring-offset-1 ring-offset-kp-bg' : '',
        ].join(' ')}
      >
        {/* Cuerpo — clickeable para ver artículos */}
        <div
          className="p-5 cursor-pointer"
          onClick={() => onExpand(expandida ? null : cat.id)}
        >
          {/* Header: letra + nombre */}
          <div className="flex items-start gap-3 mb-4">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0 ${LETTER_COLORS[idx]}`}>
              {cat.nombre[0]}
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-kp-white leading-tight line-clamp-2 uppercase tracking-wide">
                {cat.nombre}
              </h3>
              {!cat.activo && (
                <span className="text-[10px] text-kp-gray font-semibold">Inactiva</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Artículos */}
            <span className={[
              'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg',
              cat.articulos_count > 0
                ? 'bg-kp-surface2/80 text-kp-gray-lt border border-kp-border/60'
                : 'text-kp-border text-xs',
            ].join(' ')}>
              <IcoBox />
              {cat.articulos_count > 0
                ? `${cat.articulos_count} artículo${cat.articulos_count !== 1 ? 's' : ''}`
                : 'Sin artículos'}
            </span>
          </div>

          {/* Hint ver artículos */}
          {cat.articulos_count > 0 && (
            <p className={`text-[10px] mt-3 flex items-center gap-1 transition-colors ${expandida ? 'text-kp-red' : 'text-kp-gray group-hover:text-kp-gray-lt'}`}>
              <IcoList />
              {expandida ? 'Clic para cerrar' : 'Clic para ver artículos'}
            </p>
          )}

          {/* Error de borrado */}
          {delError && (
            <p className="text-[11px] text-rose-400 mt-2 bg-rose-500/10 rounded-lg px-2 py-1">{delError}</p>
          )}
        </div>

        {/* Acciones — footer */}
        {isAdmin && (
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5" onClick={e => e.stopPropagation()}>
            {/* Toggle activo */}
            <button
              onClick={() => onToggle(cat.id, !cat.activo)}
              className={[
                'text-[10px] font-bold flex items-center gap-1 transition-colors',
                cat.activo
                  ? 'text-kp-gray hover:text-rose-400'
                  : 'text-kp-gray hover:text-green-400',
              ].join(' ')}
              title={cat.activo ? 'Desactivar' : 'Activar'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cat.activo ? 'bg-green-400' : 'bg-kp-gray'}`} />
              {cat.activo ? 'Activa' : 'Inactiva'}
            </button>

            {/* Editar + Eliminar */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditando(true)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-kp-gray hover:text-kp-white hover:bg-white/10 transition-colors"
                title="Editar"
              >
                <IcoEdit />
              </button>

              {cat.articulos_count === 0 && (
                confirmDel ? (
                  <div className="flex items-center gap-1 ml-1">
                    <button onClick={handleDelete} disabled={deleting}
                      className="text-[10px] font-bold text-rose-400 hover:underline">
                      {deleting ? '…' : 'Confirmar'}
                    </button>
                    <span className="text-kp-border text-[10px]">/</span>
                    <button onClick={() => { setConfirmDel(false); setDelError(''); }}
                      className="text-[10px] font-bold text-kp-gray hover:underline">No</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDel(true)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-kp-gray hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Eliminar"
                  >
                    <IcoTrash />
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {editando && (
        <FormCategoria
          inicial={cat}
          onSave={handleSave}
          onClose={() => setEditando(false)}
        />
      )}
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CategoriasView({ categoriasIniciales }: { categoriasIniciales: Categoria[] }) {
  const { user }  = useAuth();
  const isAdmin   = user?.rol === 'administrador';

  const [cats,          setCats]          = useState<Categoria[]>(categoriasIniciales);
  const [showForm,      setShowForm]      = useState(false);
  const [seleccionada,  setSeleccionada]  = useState('');
  const [filtroActivo,  setFiltroActivo]  = useState<'true' | 'all' | 'false'>('true');
  const [catExpandida,  setCatExpandida]  = useState<string | null>(null);
  const [articulosCat,  setArticulosCat]  = useState<ArticuloCat[]>([]);
  const [loadingArt,    setLoadingArt]    = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Categorías para el buscador (respeta filtro activo pero no la selección)
  const catsParaBuscador = cats.filter(c =>
    filtroActivo === 'all' ? true : c.activo === (filtroActivo === 'true')
  );

  // Categorías a mostrar en grilla
  const filtered = catsParaBuscador.filter(c =>
    !seleccionada || c.id === seleccionada
  );

  const totalArticulos = cats.filter(c => c.activo).reduce((s, c) => s + c.articulos_count, 0);

  // Fetch artículos de la categoría expandida
  useEffect(() => {
    if (!catExpandida) { setArticulosCat([]); return; }
    let cancelled = false;
    setLoadingArt(true);
    apiFetch(`/api/articulos?categoria_id=${catExpandida}&activo=all&limit=500`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) setArticulosCat(data.articulos ?? []);
      })
      .catch(() => { if (!cancelled) setArticulosCat([]); })
      .finally(() => { if (!cancelled) setLoadingArt(false); });
    return () => { cancelled = true; };
  }, [catExpandida]);

  // Scroll al panel cuando se expande
  useEffect(() => {
    if (catExpandida && panelRef.current) {
      setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [catExpandida]);

  const handleExpand = useCallback((id: string | null) => {
    setCatExpandida(prev => prev === id ? null : id);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCreated = (c: Categoria) =>
    setCats(prev => [...prev, c].sort((a, b) => a.nombre.localeCompare(b.nombre)));

  const handleSave = useCallback(async (id: string, nombre: string, margen: number): Promise<string | null> => {
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
  }, []);

  const handleDelete = useCallback(async (id: string): Promise<string | null> => {
    try {
      const r = await apiFetch(`/api/categorias/${id}`, { method: 'DELETE' });
      const data = await r.json();
      if (!r.ok) return data.error || `Error ${r.status}`;
      setCats(prev => prev.filter(c => c.id !== id));
      if (seleccionada === id) setSeleccionada('');
      return null;
    } catch { return 'Error de conexión'; }
  }, [seleccionada]);

  const handleToggle = useCallback(async (id: string, activo: boolean) => {
    setCats(prev => prev.map(c => c.id === id ? { ...c, activo } : c));
    try {
      const r = await apiFetch(`/api/categorias/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activo }),
      });
      if (!r.ok) setCats(prev => prev.map(c => c.id === id ? { ...c, activo: !activo } : c));
    } catch {
      setCats(prev => prev.map(c => c.id === id ? { ...c, activo: !activo } : c));
    }
  }, []);

  const handleNuevaSave = async (nombre: string, margen: number) => {
    try {
      const r = await apiFetch('/api/categorias', {
        method: 'POST',
        body: JSON.stringify({ nombre, margen_default: margen }),
      });
      const data = await r.json();
      if (!r.ok) return data.error || `Error ${r.status}`;
      handleCreated(data.categoria);
      return null;
    } catch { return 'Error de conexión'; }
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
              {filtered.length} de {catsParaBuscador.length} categorías
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

      {/* ── Barra de herramientas ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Buscador desplegable */}
        <BuscadorDesplegable
          categorias={catsParaBuscador}
          seleccionada={seleccionada}
          onSelect={setSeleccionada}
        />

        {/* Filtro activo */}
        <div className="flex rounded-xl overflow-hidden border border-kp-border text-xs font-semibold">
          {(['true', 'all', 'false'] as const).map(val => {
            const labels = { true: 'Activas', all: 'Todas', false: 'Inactivas' };
            return (
              <button key={val}
                onClick={() => { setFiltroActivo(val); setSeleccionada(''); }}
                className={`px-3 py-2 transition-colors ${filtroActivo === val
                  ? 'bg-kp-red text-white'
                  : 'bg-kp-surface text-kp-gray hover:text-kp-white'}`}
              >
                {labels[val]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Grilla de tarjetas ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-kp-gray">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-sm">No se encontraron categorías.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(cat => (
            <CategoriaCard
              key={cat.id}
              cat={cat}
              isAdmin={isAdmin}
              highlighted={cat.id === seleccionada}
              expandida={cat.id === catExpandida}
              onSave={handleSave}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onExpand={handleExpand}
            />
          ))}
        </div>
      )}

      {/* ── Panel artículos de la categoría expandida ── */}
      {catExpandida && (() => {
        const cat = cats.find(c => c.id === catExpandida);
        const idx = cat ? paletteIdx(cat.nombre) : 0;
        const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 });
        return (
          <div ref={panelRef} className={`rounded-2xl border bg-gradient-to-b from-kp-surface2 to-kp-surface border-kp-border`}>
            {/* Header del panel */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-kp-border">
              <div className="flex items-center gap-3">
                {cat && (
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0 ${LETTER_COLORS[idx]}`}>
                    {cat.nombre[0]}
                  </span>
                )}
                <div>
                  <h3 className="text-sm font-bold text-kp-white uppercase tracking-wide">{cat?.nombre}</h3>
                  {!loadingArt && (
                    <p className="text-[11px] text-kp-gray mt-0.5">{articulosCat.length} artículo{articulosCat.length !== 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setCatExpandida(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-kp-gray hover:text-kp-white hover:bg-white/10 transition-colors"
                title="Cerrar"
              >
                <IcoClose />
              </button>
            </div>

            {/* Contenido */}
            {loadingArt ? (
              <div className="flex items-center justify-center py-10 text-kp-gray text-sm gap-2">
                <span className="animate-spin text-lg">⟳</span>
                Cargando artículos…
              </div>
            ) : articulosCat.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-kp-gray">
                <p className="text-3xl mb-2">📦</p>
                <p className="text-sm">Sin artículos en esta categoría.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-kp-gray uppercase tracking-wider border-b border-kp-border/60">
                      <th className="text-left px-5 py-3 font-semibold">Código</th>
                      <th className="text-left px-5 py-3 font-semibold">Nombre</th>
                      <th className="text-right px-5 py-3 font-semibold">Precio madre</th>
                      <th className="text-right px-5 py-3 font-semibold">Margen</th>
                      <th className="text-right px-5 py-3 font-semibold">Stock total</th>
                      <th className="text-center px-5 py-3 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-kp-border/30">
                    {articulosCat.map((a, i) => (
                      <tr key={a.id} className={`transition-colors hover:bg-white/5 ${i % 2 === 0 ? '' : 'bg-white/[0.02]'}`}>
                        <td className="px-5 py-3 font-mono text-xs text-kp-gray-lt">{a.codigo}</td>
                        <td className="px-5 py-3 text-kp-white font-medium max-w-xs truncate">{a.nombre}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-kp-white">
                          {isNaN(parseFloat(a.precio_madre)) ? '—' : ars.format(parseFloat(a.precio_madre))}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {a.margen_aplicado != null
                            ? <span className="text-green-400 font-semibold">+{parseFloat(a.margen_aplicado).toFixed(0)}%</span>
                            : <span className="text-kp-gray text-xs">Cat. ({cat?.margen_default.toFixed(0)}%)</span>}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-kp-gray-lt">
                          {parseFloat(a.stock_total) > 0
                            ? <span className="text-kp-white">{parseFloat(a.stock_total).toFixed(0)}</span>
                            : <span className="text-kp-gray">0</span>}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${a.activo ? 'bg-green-500/15 text-green-400' : 'bg-kp-surface2 text-kp-gray'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${a.activo ? 'bg-green-400' : 'bg-kp-gray'}`} />
                            {a.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* Aviso margen */}
      {isAdmin && (
        <p className="text-[11px] text-kp-gray px-1">
          💡 Editar el margen actualiza automáticamente todos los artículos de esa categoría.
        </p>
      )}

      {/* Modal nueva categoría */}
      {showForm && (
        <FormCategoria
          onSave={handleNuevaSave}
          onClose={() => setShowForm(false)}
        />
      )}
    </section>
  );
}
