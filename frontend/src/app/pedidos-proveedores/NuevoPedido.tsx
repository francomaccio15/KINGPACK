'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type Sucursal   = { id: string; nombre: string };
type Proveedor  = { id: string; razon_social: string };

interface ArticuloResult {
  id: string;
  nombre: string;
  codigo: string;
  precio_madre: number;
}

interface LineItem {
  articulo_id: string;
  nombre: string;
  codigo: string;
  cantidad: number;
  precio_compra: number;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-kp-gray" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function NuevoPedido({
  sucursales,
  proveedores,
}: {
  sucursales: Sucursal[];
  proveedores: Proveedor[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [sucursalId, setSucursalId]     = useState(sucursales[0]?.id ?? '');
  const [proveedorId, setProveedorId]   = useState('');
  const [nroFactura, setNroFactura]     = useState('');
  const [flete, setFlete]               = useState('');
  const [items, setItems]               = useState<LineItem[]>([]);

  // ── Artículo search ─────────────────────────────────────────────────────────
  const [artQ, setArtQ]                 = useState('');
  const [artResults, setArtResults]     = useState<ArticuloResult[]>([]);
  const [artLoading, setArtLoading]     = useState(false);
  const artDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Save state ──────────────────────────────────────────────────────────────
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);

  const reset = () => {
    setSucursalId(sucursales[0]?.id ?? '');
    setProveedorId('');
    setNroFactura('');
    setFlete('');
    setItems([]);
    setArtQ('');
    setArtResults([]);
    setSaveError(null);
  };

  const searchArticulos = useCallback((q: string) => {
    if (artDebounce.current) clearTimeout(artDebounce.current);
    if (!q.trim()) { setArtResults([]); return; }
    artDebounce.current = setTimeout(async () => {
      setArtLoading(true);
      try {
        const res = await apiFetch(`/api/articulos?q=${encodeURIComponent(q)}&limit=10`);
        const data = await res.json();
        setArtResults(data.articulos ?? []);
      } catch {
        setArtResults([]);
      } finally {
        setArtLoading(false);
      }
    }, 280);
  }, []);

  const addItem = (art: ArticuloResult) => {
    setItems(prev => {
      const existing = prev.find(i => i.articulo_id === art.id);
      if (existing) {
        return prev.map(i => i.articulo_id === art.id
          ? { ...i, cantidad: i.cantidad + 1 }
          : i
        );
      }
      return [...prev, {
        articulo_id: art.id,
        nombre: art.nombre,
        codigo: art.codigo,
        cantidad: 1,
        precio_compra: art.precio_madre ?? 0,
      }];
    });
    setArtQ('');
    setArtResults([]);
  };

  const updateItem = (idx: number, field: 'cantidad' | 'precio_compra', value: string) => {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: parseFloat(value) || 0 } : item
    ));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Totales ─────────────────────────────────────────────────────────────────
  const fleteNum      = parseFloat(flete) || 0;
  const totalMerc     = items.reduce((s, i) => s + i.precio_compra * i.cantidad, 0);
  const totalGeneral  = totalMerc + fleteNum;

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!proveedorId) { setSaveError('Seleccioná un proveedor'); return; }
    if (!sucursalId)  { setSaveError('Seleccioná una sucursal'); return; }
    if (items.length === 0) { setSaveError('Agregá al menos un artículo'); return; }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch(`/api/pedidos-compra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor_id: proveedorId,
          sucursal_id: sucursalId,
          numero_factura_prov: nroFactura || null,
          costo_flete_total: fleteNum,
          items: items.map(i => ({
            articulo_id: i.articulo_id,
            cantidad: i.cantidad,
            precio_compra: i.precio_compra,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? 'Error al guardar'); return; }
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setSaveError('Error de conexión con el servidor');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const inputCls = 'w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Nuevo Pedido
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-kp-surface border border-kp-border rounded-2xl shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border bg-kp-surface2">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-kp-red rounded-full block" />
                <h3 className="text-base font-bold uppercase tracking-wide">Nuevo Pedido a Proveedor</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-kp-gray hover:text-kp-white transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body — dos columnas */}
            <div className="flex flex-1 min-h-0">

              {/* Columna izquierda — formulario */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 border-r border-kp-border">

                {/* Proveedor + Sucursal */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Proveedor *</label>
                    <select
                      value={proveedorId}
                      onChange={e => setProveedorId(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">— Seleccionar —</option>
                      {proveedores.map(p => (
                        <option key={p.id} value={p.id}>{p.razon_social}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Sucursal *</label>
                    <select
                      value={sucursalId}
                      onChange={e => setSucursalId(e.target.value)}
                      className={inputCls}
                    >
                      {sucursales.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Nº Factura + Flete */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Nº Factura Proveedor</label>
                    <input
                      type="text"
                      placeholder="0001-00012345"
                      value={nroFactura}
                      onChange={e => setNroFactura(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Costo de Flete</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={flete}
                      onChange={e => setFlete(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Buscador de artículos */}
                <div>
                  <label className={labelCls}>Agregar Artículo</label>
                  <div className="relative">
                    <input
                      type="search"
                      placeholder="Buscar por nombre o código…"
                      value={artQ}
                      onChange={e => { setArtQ(e.target.value); searchArticulos(e.target.value); }}
                      className={inputCls}
                    />
                    {artLoading && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Spinner />
                      </span>
                    )}
                    {artResults.length > 0 && (
                      <ul className="absolute z-10 w-full mt-1 bg-kp-surface2 border border-kp-border rounded-lg shadow-xl overflow-hidden">
                        {artResults.map(a => (
                          <li key={a.id}>
                            <button
                              type="button"
                              onClick={() => addItem(a)}
                              className="w-full text-left px-4 py-2.5 hover:bg-kp-red/10 transition-colors flex items-center justify-between gap-3"
                            >
                              <div>
                                <span className="text-sm font-medium text-kp-white">{a.nombre}</span>
                                <span className="ml-2 text-xs text-kp-gray font-mono">{a.codigo}</span>
                              </div>
                              <span className="text-xs text-kp-gray-lt tabular-nums whitespace-nowrap">
                                {ars.format(a.precio_madre)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Tabla de items */}
                {items.length > 0 && (
                  <div className="rounded-xl border border-kp-border overflow-hidden">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-kp-surface2 border-b border-kp-border">
                          <th className="text-left px-3 py-2 text-xs text-kp-gray uppercase tracking-widest font-semibold">Artículo</th>
                          <th className="text-right px-3 py-2 text-xs text-kp-gray uppercase tracking-widest font-semibold w-24">Cant.</th>
                          <th className="text-right px-3 py-2 text-xs text-kp-gray uppercase tracking-widest font-semibold w-32">P. Compra</th>
                          <th className="text-right px-3 py-2 text-xs text-kp-gray uppercase tracking-widest font-semibold w-28">Subtotal</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-kp-border">
                        {items.map((item, idx) => (
                          <tr key={item.articulo_id} className="bg-kp-surface">
                            <td className="px-3 py-2">
                              <div className="text-sm font-medium text-kp-white">{item.nombre}</div>
                              <div className="text-xs text-kp-gray font-mono">{item.codigo}</div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0.001"
                                step="1"
                                value={item.cantidad}
                                onChange={e => updateItem(idx, 'cantidad', e.target.value)}
                                className="w-full text-right bg-kp-surface2 border border-kp-border rounded px-2 py-1 text-sm text-kp-white focus:outline-none focus:border-kp-red"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.precio_compra}
                                onChange={e => updateItem(idx, 'precio_compra', e.target.value)}
                                className="w-full text-right bg-kp-surface2 border border-kp-border rounded px-2 py-1 text-sm text-kp-white focus:outline-none focus:border-kp-red"
                              />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-sm text-kp-white font-semibold">
                              {ars.format(item.precio_compra * item.cantidad)}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="text-kp-gray hover:text-kp-red transition-colors"
                                title="Eliminar"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Columna derecha — resumen */}
              <div className="w-72 flex-shrink-0 flex flex-col p-6 bg-kp-surface2 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Resumen del Pedido</h4>

                <div className="space-y-3 flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-kp-gray">Mercadería</span>
                    <span className="tabular-nums text-kp-white">{ars.format(totalMerc)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-kp-gray">Flete</span>
                    <span className="tabular-nums text-kp-gray-lt">{ars.format(fleteNum)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-kp-gray">Artículos</span>
                    <span className="tabular-nums text-kp-gray-lt">{items.length}</span>
                  </div>

                  <div className="border-t border-kp-border pt-3">
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-kp-white uppercase tracking-wide">Total</span>
                      <span className="text-lg font-bold tabular-nums text-kp-white">{ars.format(totalGeneral)}</span>
                    </div>
                  </div>
                </div>

                {saveError && (
                  <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-3 py-2">
                    {saveError}
                  </p>
                )}

                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleSubmit}
                    disabled={saving || items.length === 0 || !proveedorId}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? <><Spinner /> Guardando…</> : 'Registrar Pedido'}
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="w-full px-4 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
