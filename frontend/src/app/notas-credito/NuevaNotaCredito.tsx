'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { NotaCredito, NcItem } from './page';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string,string>||{}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
};

// ─── Buscador de artículos inline ────────────────────────────────────────────
interface ArtResult { id: string; nombre: string; codigo: string; precio_madre: number }

function ArticuloInput({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (art: ArtResult) => void;
}) {
  const [query,    setQuery]    = useState(value);
  const [results,  setResults]  = useState<ArtResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef     = useRef<HTMLDivElement>(null);

  // Sync external value changes (e.g., clear)
  useEffect(() => { setQuery(value); }, [value]);

  // Cerrar al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Búsqueda debounced
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) { setResults([]); setOpen(false); return; }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await apiFetch(`/api/articulos?q=${encodeURIComponent(query.trim())}&limit=20`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        setResults(data.articulos ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleChange = (v: string) => {
    setQuery(v);
    onChange(v);          // propagate text immediately
  };

  const handleSelect = (art: ArtResult) => {
    setQuery(art.nombre);
    onChange(art.nombre);
    onSelect(art);
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative">
        <input
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Buscar artículo o escribir descripción…"
          className="w-full bg-transparent border-b border-kp-border/50 focus:border-kp-red text-sm text-kp-white placeholder:text-kp-gray/50 outline-none py-0.5 pr-5 transition-colors"
        />
        {loading && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-3 w-3 text-kp-gray" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-kp-surface border border-kp-border rounded-xl shadow-2xl shadow-black/60 overflow-hidden max-h-52 overflow-y-auto">
          {results.map(art => (
            <button
              key={art.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(art); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-kp-surface2 transition-colors border-b border-kp-border/40 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-kp-white truncate">{art.nombre}</p>
                <p className="text-[10px] text-kp-gray font-mono">{art.codigo}</p>
              </div>
              <span className="text-xs text-kp-gray-lt tabular-nums shrink-0">
                {new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2}).format(art.precio_madre)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Cliente        = { id: string; razon_social: string; cuit: string | null };
type Sucursal       = { id: string; nombre: string };
type TipoComprobante = { id: string; codigo_afip: number; letra: string; descripcion: string };

const MOTIVOS_PRESET = [
  'Devolución de mercadería',
  'Error en precio cobrado de más',
  'Descuento comercial no aplicado',
  'Anulación parcial de factura',
  'Diferencia de precios',
];

const IVA_OPCIONES = [
  { label: '0% (Exento)', value: 0 },
  { label: '10,5%', value: 10.5 },
  { label: '21%', value: 21 },
  { label: '27%', value: 27 },
];

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

interface Props {
  clientes: Cliente[];
  sucursales: Sucursal[];
  tiposNC: TipoComprobante[];
  onCreate: (nc: NotaCredito) => void;
  onClose: () => void;
}

const emptyItem = (): NcItem => ({ descripcion: '', cantidad: 1, precio_unitario: 0, subtotal: 0, articulo_id: undefined });

export default function NuevaNotaCredito({ clientes, sucursales, tiposNC, onCreate, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [clienteId,       setClienteId]       = useState('');
  const [sucursalId,      setSucursalId]       = useState(sucursales[0]?.id ?? '');
  const [tipoId,          setTipoId]           = useState(tiposNC[1]?.id ?? ''); // default B
  const [fecha,           setFecha]            = useState(today);
  const [numRef,          setNumRef]           = useState('');
  const [motivo,          setMotivo]           = useState('');
  const [ivaPct,          setIvaPct]           = useState(21);
  const [items,           setItems]            = useState<NcItem[]>([emptyItem()]);
  const [saving,          setSaving]           = useState(false);
  const [error,           setError]            = useState('');

  // Calcular totales
  const subtotal = items.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0);
  const ivaMonto = Math.round(subtotal * (ivaPct / 100) * 100) / 100;
  const total    = Math.round((subtotal + ivaMonto) * 100) / 100;

  const updateItem = (i: number, field: keyof NcItem, val: string | number) => {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const updated = { ...it, [field]: field === 'descripcion' ? val : (parseFloat(String(val)) || 0) };
      updated.subtotal = updated.cantidad * updated.precio_unitario;
      return updated;
    }));
  };

  const selectArticulo = (i: number, art: ArtResult) => {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const updated = { ...it, descripcion: art.nombre, precio_unitario: art.precio_madre, articulo_id: art.id };
      updated.subtotal = updated.cantidad * updated.precio_unitario;
      return updated;
    }));
  };

  const addItem    = () => setItems(p => [...p, emptyItem()]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!motivo.trim()) { setError('El motivo es obligatorio'); return; }
    if (!tipoId)        { setError('Seleccioná el tipo de comprobante'); return; }
    if (items.some(it => !it.descripcion.trim())) { setError('Completá la descripción de cada ítem'); return; }
    if (total <= 0)     { setError('El total debe ser mayor a 0'); return; }

    setSaving(true);
    try {
      const r = await apiFetch('/api/notas-credito', {
        method: 'POST',
        body: JSON.stringify({
          cliente_id:          clienteId || null,
          sucursal_id:         sucursalId || null,
          tipo_comprobante_id: tipoId,
          numero_referencia:   numRef || null,
          motivo,
          items,
          subtotal,
          iva_pct:             ivaPct,
          iva_monto:           ivaMonto,
          total,
          fecha,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error || `Error ${r.status}`);
        return;
      }
      const { nota } = await r.json();
      onCreate(nota);
      onClose();
    } catch (err) {
      setError('No se pudo guardar. Revisá la conexión.');
    } finally {
      setSaving(false);
    }
  };

  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wider text-kp-gray mb-1';
  const inputCls = 'w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const selectCls = inputCls + ' cursor-pointer';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm pt-8 pb-8 overflow-y-auto">
      <div className="w-full max-w-3xl mx-4 bg-kp-surface rounded-2xl border border-kp-border shadow-2xl shadow-black/60">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border bg-kp-surface2 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <span className="w-1 h-6 bg-kp-red rounded-full" />
            <h2 className="text-base font-bold uppercase tracking-wide">Nueva Nota de Crédito</h2>
          </div>
          <button onClick={onClose} className="text-kp-gray hover:text-kp-white transition-colors text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Fila 1: Tipo + Fecha + Referencia */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Tipo de comprobante *</label>
              <select value={tipoId} onChange={e => setTipoId(e.target.value)} required className={selectCls}>
                {tiposNC.map(t => (
                  <option key={t.id} value={t.id}>{t.descripcion}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha de emisión *</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Factura / Doc. de referencia</label>
              <input
                type="text" value={numRef}
                onChange={e => setNumRef(e.target.value)}
                placeholder="Ej: FAC-B 0001-00000437"
                className={inputCls}
              />
            </div>
          </div>

          {/* Fila 2: Cliente + Sucursal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Cliente (receptor)</label>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={selectCls}>
                <option value="">Consumidor final / Sin cliente</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.razon_social}{c.cuit ? ` — ${c.cuit}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Sucursal emisora</label>
              <select value={sucursalId} onChange={e => setSucursalId(e.target.value)} className={selectCls}>
                <option value="">Sin sucursal</option>
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className={labelCls}>Motivo de la nota de crédito *</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {MOTIVOS_PRESET.map(m => (
                <button
                  key={m} type="button"
                  onClick={() => setMotivo(m)}
                  className={[
                    'text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors',
                    motivo === m
                      ? 'bg-kp-red/15 border-kp-red/40 text-kp-red'
                      : 'bg-kp-surface2 border-kp-border text-kp-gray hover:text-kp-white',
                  ].join(' ')}
                >
                  {m}
                </button>
              ))}
            </div>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={2}
              placeholder="Descripción del motivo de la nota de crédito..."
              className={inputCls + ' resize-none'}
              required
            />
          </div>

          {/* Ítems */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + ' mb-0'}>Detalle de ítems *</label>
              <button
                type="button" onClick={addItem}
                className="text-xs font-semibold text-kp-red hover:underline flex items-center gap-1"
              >
                + Agregar ítem
              </button>
            </div>

            <div className="rounded-xl border border-kp-border">
              {/* Header tabla */}
              <div className="grid grid-cols-[1fr_80px_110px_100px_36px] gap-2 px-3 py-2 bg-kp-surface2 border-b border-kp-border rounded-t-xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-kp-gray">Descripción</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-kp-gray text-center">Cant.</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-kp-gray text-right">Precio unit.</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-kp-gray text-right">Subtotal</span>
                <span />
              </div>

              {/* Filas */}
              <div className="divide-y divide-kp-border/40">
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_110px_100px_36px] gap-2 px-3 py-2.5 items-center bg-kp-surface">
                    <ArticuloInput
                      value={it.descripcion}
                      onChange={v => updateItem(i, 'descripcion', v)}
                      onSelect={art => selectArticulo(i, art)}
                    />
                    <input
                      type="number" min="0.01" step="any"
                      value={it.cantidad}
                      onChange={e => updateItem(i, 'cantidad', e.target.value)}
                      className="w-full bg-transparent border-b border-kp-border/50 focus:border-kp-red text-sm text-kp-white text-center outline-none py-0.5 tabular-nums transition-colors"
                    />
                    <input
                      type="number" min="0" step="any"
                      value={it.precio_unitario}
                      onChange={e => updateItem(i, 'precio_unitario', e.target.value)}
                      className="w-full bg-transparent border-b border-kp-border/50 focus:border-kp-red text-sm text-kp-white text-right outline-none py-0.5 tabular-nums transition-colors"
                    />
                    <span className="text-sm text-kp-gray-lt text-right tabular-nums">
                      {ars.format(it.cantidad * it.precio_unitario)}
                    </span>
                    <button
                      type="button"
                      onClick={() => items.length > 1 && removeItem(i)}
                      disabled={items.length === 1}
                      className="text-kp-gray hover:text-rose-400 transition-colors disabled:opacity-20 text-lg leading-none"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* IVA + Totales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className={labelCls}>Alícuota IVA</label>
              <select
                value={ivaPct}
                onChange={e => setIvaPct(parseFloat(e.target.value))}
                className={selectCls}
              >
                {IVA_OPCIONES.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="bg-kp-surface2 border border-kp-border rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm text-kp-gray">
                <span>Subtotal (neto)</span>
                <span className="tabular-nums text-kp-white">{ars.format(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-kp-gray">
                <span>IVA {ivaPct}%</span>
                <span className="tabular-nums text-kp-white">{ars.format(ivaMonto)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-kp-border pt-2">
                <span className="text-kp-white">TOTAL a favor</span>
                <span className="text-kp-red tabular-nums">{ars.format(total)}</span>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-5 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-border/60 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/80 disabled:opacity-50 transition-colors">
              {saving ? 'Guardando…' : 'Emitir Nota de Crédito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
