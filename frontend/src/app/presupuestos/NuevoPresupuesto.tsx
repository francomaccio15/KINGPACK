'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';

// ─── Types ────────────────────────────────────────────────────────────────────

type Sucursal = { id: string; nombre: string };
type Lista    = { id: string; nombre: string; descuento_lista: number };

interface ArticuloResult {
  id: string;
  nombre: string;
  codigo: string;
  precio_madre: number;
  precio_lista: number;
  stock_total: number;
  stock_bajo: boolean;
}

interface ClienteResult {
  id: string;
  razon_social: string;
  lista_precio_id: string | null;
  lista_precio: string | null;
  descuento_adicional: number;
}

interface CartItem {
  articulo_id: string;
  nombre: string;
  codigo: string;
  cantidad: number;
  precio_lista: number;
  precio_madre: number;
  descuento_pct: number;
  precio_unitario_final: number;
  stock_disponible: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcCombinedDiscount(d1: number, d2: number): number {
  const result = (1 - (1 - d1 / 100) * (1 - d2 / 100)) * 100;
  return Math.round(result * 100) / 100;
}

function calcFinalPrice(precioLista: number, discountPct: number): number {
  return precioLista * (1 - discountPct / 100);
}

function recalcItem(item: CartItem, descuentoLista: number, descuentoCliente: number): CartItem {
  // El precio de lista (precio_efectivo) YA incluye el descuento de la lista.
  // Sobre ese precio solo se aplica el descuento adicional del cliente; el
  // backend calcula igual (precio_efectivo × (1 − descuento_pct)), por lo que
  // descuento_pct debe ser únicamente el del cliente para no duplicar la lista.
  const precio_lista = item.precio_madre * (1 - descuentoLista / 100);
  const descuento_pct = descuentoCliente;
  const precio_unitario_final = calcFinalPrice(precio_lista, descuento_pct);
  return { ...item, precio_lista, descuento_pct, precio_unitario_final };
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-kp-gray" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NuevoPresupuesto({
  sucursales,
  listas,
  sucursalDefaultId,
}: {
  sucursales: Sucursal[];
  listas: Lista[];
  sucursalDefaultId: string | null;
}) {
  const router = useRouter();

  const initialSucursal = sucursalDefaultId && sucursales.some(s => s.id === sucursalDefaultId)
    ? sucursalDefaultId
    : (sucursales.find(s => /laprida/i.test(s.nombre))?.id ?? sucursales[0]?.id ?? '');

  const [open, setOpen] = useState(false);
  const [sucursalId, setSucursalId] = useState<string>(initialSucursal);

  // Article search
  const [artQuery, setArtQuery]     = useState('');
  const [artResults, setArtResults] = useState<ArticuloResult[]>([]);
  const [artLoading, setArtLoading] = useState(false);
  const artDebounceRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Client
  const [clientMode, setClientMode]         = useState<'publico' | 'especifico'>('publico');
  const [clientQuery, setClientQuery]       = useState('');
  const [clientResults, setClientResults]   = useState<ClienteResult[]>([]);
  const [clientLoading, setClientLoading]   = useState(false);
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClienteResult | null>(null);
  const clientDebounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientDropRef                       = useRef<HTMLDivElement>(null);

  // Lista de precios
  const [listaId, setListaId] = useState<string>('');

  const descuentoLista   = listas.find(l => l.id === listaId)?.descuento_lista ?? 0;
  const descuentoCliente = selectedClient?.descuento_adicional ?? 0;

  // Save state
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState('');

  // ─── Reset ────────────────────────────────────────────────────────────────
  const resetModal = useCallback(() => {
    setArtQuery('');
    setArtResults([]);
    setCart([]);
    setClientMode('publico');
    setClientQuery('');
    setClientResults([]);
    setClientDropOpen(false);
    setSelectedClient(null);
    setListaId('');
    setSaveError('');
    setSaving(false);
    setSucursalId(initialSucursal);
  }, [initialSucursal]);

  const cerrar = useCallback(() => {
    setOpen(false);
    resetModal();
  }, [resetModal]);

  // ─── Article search (debounced) ─────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (artDebounceRef.current) clearTimeout(artDebounceRef.current);

    if (!artQuery.trim()) {
      setArtResults([]);
      setArtLoading(false);
      return;
    }

    setArtLoading(true);
    artDebounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: artQuery.trim(), limit: '30' });
        if (listaId)    params.set('lista_id',    listaId);
        if (sucursalId) params.set('sucursal_id', sucursalId);
        const r = await apiFetch(`/api/articulos?${params}`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        setArtResults(data.articulos ?? data ?? []);
      } catch {
        setArtResults([]);
      } finally {
        setArtLoading(false);
      }
    }, 300);

    return () => { if (artDebounceRef.current) clearTimeout(artDebounceRef.current); };
  }, [artQuery, listaId, sucursalId, open]);

  // ─── Client search (debounced) ──────────────────────────────────────────────
  useEffect(() => {
    if (clientMode !== 'especifico') return;
    if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current);

    if (!clientQuery.trim()) {
      setClientResults([]);
      setClientLoading(false);
      return;
    }

    setClientLoading(true);
    clientDebounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: clientQuery.trim(), limit: '20' });
        const r = await apiFetch(`/api/clientes?${params}`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        setClientResults(data.clientes ?? data ?? []);
        setClientDropOpen(true);
      } catch {
        setClientResults([]);
      } finally {
        setClientLoading(false);
      }
    }, 300);

    return () => { if (clientDebounceRef.current) clearTimeout(clientDebounceRef.current); };
  }, [clientQuery, clientMode]);

  // ─── Close client dropdown on outside click ─────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientDropRef.current && !clientDropRef.current.contains(e.target as Node)) {
        setClientDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Auto-select client list ────────────────────────────────────────────────
  useEffect(() => {
    if (selectedClient?.lista_precio_id) {
      setListaId(selectedClient.lista_precio_id);
    }
  }, [selectedClient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Recalculate cart when lista or client discount changes ─────────────────
  useEffect(() => {
    setCart(prev => prev.map(item => recalcItem(item, descuentoLista, descuentoCliente)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaId, selectedClient?.id]);

  // ─── Cart ops ───────────────────────────────────────────────────────────────
  const addToCart = useCallback((art: ArticuloResult) => {
    setCart(prev => {
      const existing = prev.findIndex(i => i.articulo_id === art.id);
      if (existing !== -1) {
        return prev.map((item, idx) => idx === existing ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      // art.precio_lista = precio_efectivo de la lista (ya trae el descuento de
      // la lista incorporado). Sobre ese precio se aplica SOLO el descuento
      // adicional del cliente — igual que el backend. Aplicar acá el descuento
      // combinado (lista + cliente) duplicaba el descuento de la lista.
      const precioEfectivo = art.precio_lista ?? art.precio_madre;
      const descuento      = descuentoCliente;
      const finalPrice     = calcFinalPrice(precioEfectivo, descuento);
      return [
        ...prev,
        {
          articulo_id:           art.id,
          nombre:                art.nombre,
          codigo:                art.codigo,
          cantidad:              1,
          precio_lista:          precioEfectivo,
          precio_madre:          art.precio_madre,
          descuento_pct:         descuento,
          precio_unitario_final: finalPrice,
          stock_disponible:      art.stock_total ?? 0,
        },
      ];
    });
  }, [descuentoLista, descuentoCliente]);

  const updateQty = useCallback((articuloId: string, delta: number) => {
    setCart(prev => prev.map(item =>
      item.articulo_id === articuloId ? { ...item, cantidad: Math.max(1, item.cantidad + delta) } : item
    ));
  }, []);

  const setQty = useCallback((articuloId: string, raw: string) => {
    const val = parseInt(raw, 10);
    if (isNaN(val) || raw === '') {
      setCart(prev => prev.map(item => item.articulo_id === articuloId ? { ...item, cantidad: 0 } : item));
      return;
    }
    setCart(prev => prev.map(item => item.articulo_id === articuloId ? { ...item, cantidad: Math.max(1, val) } : item));
  }, []);

  const commitQty = useCallback((articuloId: string) => {
    setCart(prev => prev.map(item =>
      item.articulo_id === articuloId ? { ...item, cantidad: Math.max(1, item.cantidad || 1) } : item
    ));
  }, []);

  const removeFromCart = useCallback((articuloId: string) => {
    setCart(prev => prev.filter(i => i.articulo_id !== articuloId));
  }, []);

  // ─── Totals ─────────────────────────────────────────────────────────────────
  const subtotalBruto = cart.reduce((acc, i) => acc + i.precio_madre * i.cantidad, 0);
  const subtotalFinal = cart.reduce((acc, i) => acc + i.precio_unitario_final * i.cantidad, 0);
  const descuentoTotal = subtotalBruto - subtotalFinal;

  // ─── Save (siempre como preventa = presupuesto) ─────────────────────────────
  const handleSave = async () => {
    if (cart.length === 0) return;
    if (!sucursalId) { setSaveError('Seleccioná una sucursal'); return; }
    setSaveError('');
    setSaving(true);

    const body = {
      sucursal_id:     sucursalId,
      cliente_id:      selectedClient?.id ?? null,
      lista_precio_id: listaId || null,
      estado:          'preventa',
      observaciones:   null,
      items: cart.map(i => ({
        articulo_id:           i.articulo_id,
        cantidad:              i.cantidad,
        precio_lista:          i.precio_lista,
        descuento_pct:         i.descuento_pct,
        precio_unitario_final: i.precio_unitario_final,
        iva_monto:             0,
      })),
      pagos: [],
    };

    try {
      const r = await apiFetch(`/api/ventas`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Error al guardar el presupuesto');
      cerrar();
      router.refresh();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const cartEmpty = cart.length === 0;

  return (
    <>
      {/* ── Trigger button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg
          bg-kp-red hover:bg-kp-red-dark transition-colors text-white text-sm font-semibold
          shadow-lg shadow-kp-red/20"
      >
        <span className="text-base leading-none font-bold">+</span>
        Nuevo Presupuesto
      </button>

      {/* ── Full-screen modal ──────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Nuevo Presupuesto"
        >
          <div className="max-w-7xl w-full mx-4 h-[90vh] bg-kp-surface border border-kp-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">

            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border shrink-0">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-1 h-6 bg-kp-red rounded-full block shrink-0" />
                  <h2 className="font-bold text-base uppercase tracking-wide text-kp-white">
                    Nuevo Presupuesto
                  </h2>
                </div>

                {sucursales.length > 0 ? (
                  <select
                    value={sucursalId}
                    onChange={e => setSucursalId(e.target.value)}
                    className="bg-kp-surface2 border border-kp-border rounded-lg px-3 py-1.5 text-xs text-kp-gray-lt
                      focus:outline-none focus:border-kp-red transition-colors"
                    aria-label="Sucursal"
                  >
                    {sucursales.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-kp-gray bg-kp-surface2 border border-kp-border rounded-lg px-3 py-1.5">
                    Sin sucursales
                  </span>
                )}
              </div>

              <button
                onClick={cerrar}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-kp-gray
                  hover:text-kp-white hover:bg-kp-surface2 transition-colors text-lg leading-none"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {/* ── Body: two panels ───────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">

              {/* ══ LEFT PANEL — Artículos + Carrito ══════════════════════ */}
              <div className="flex-1 flex flex-col overflow-hidden p-5 gap-4">

                {/* Article search */}
                <div>
                  <label className="block text-[10px] text-kp-gray uppercase tracking-widest mb-1.5">
                    Buscar artículo
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={artQuery}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setArtQuery(e.target.value)}
                      placeholder="Nombre o código de producto…"
                      className="bg-kp-surface2 border border-kp-border focus:border-kp-red rounded-lg px-3 py-2 text-sm w-full text-kp-white placeholder:text-kp-gray outline-none transition-colors pr-8"
                      autoComplete="off"
                    />
                    {artLoading && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Spinner />
                      </span>
                    )}
                  </div>
                </div>

                {/* Search results */}
                {artResults.length > 0 && (
                  <div className="border border-kp-border rounded-xl overflow-hidden shrink-0 max-h-56 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-kp-surface2 border-b border-kp-border">
                      <span className="text-[10px] text-kp-gray uppercase tracking-widest">
                        Resultados ({artResults.length})
                      </span>
                    </div>
                    {artResults.map(art => {
                      const displayPrice = art.precio_lista ?? art.precio_madre;
                      const sinStock   = art.stock_total === 0;
                      const stockBadge = sinStock
                        ? { cls: 'bg-rose-500/15 text-rose-400 border-rose-500/20',  label: 'Sin stock' }
                        : art.stock_bajo
                          ? { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20', label: `Stock: ${Number(art.stock_total).toLocaleString('es-AR')}` }
                          : { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', label: `Stock: ${Number(art.stock_total).toLocaleString('es-AR')}` };
                      return (
                        <div
                          key={art.id}
                          className="flex items-center gap-3 px-3 py-2.5 border-b border-kp-border last:border-0
                            hover:bg-kp-surface2 transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-kp-white truncate">{art.nombre}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-kp-gray">{art.codigo}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${stockBadge.cls}`}>
                                {stockBadge.label}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-kp-white tabular-nums">
                              {ars.format(displayPrice)}
                            </p>
                            {listaId && art.precio_lista !== art.precio_madre && (
                              <p className="text-[10px] text-kp-gray line-through tabular-nums">
                                {ars.format(art.precio_madre)}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => addToCart(art)}
                            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg
                              border border-kp-red text-kp-red hover:bg-kp-red hover:text-white
                              transition-colors"
                          >
                            + Agregar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {artQuery.trim() && !artLoading && artResults.length === 0 && (
                  <p className="text-xs text-kp-gray text-center py-3">
                    Sin resultados para &ldquo;{artQuery}&rdquo;
                  </p>
                )}

                {/* Cart section header */}
                <div className="flex items-center justify-between shrink-0">
                  <span className="text-[10px] text-kp-gray uppercase tracking-widest">
                    Carrito
                  </span>
                  {cart.length > 0 && (
                    <span className="text-[10px] text-kp-gray">
                      {cart.reduce((acc, i) => acc + i.cantidad, 0)} unidades
                    </span>
                  )}
                </div>

                {/* Cart items */}
                <div className="flex-1 overflow-y-auto -mr-1 pr-1">
                  {cartEmpty ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 py-12">
                      <div className="w-14 h-14 rounded-2xl bg-kp-surface2 border border-kp-border
                        flex items-center justify-center text-2xl text-kp-gray">
                        🛒
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-kp-gray">Carrito vacío</p>
                        <p className="text-xs text-kp-gray/60 mt-0.5">
                          Buscá artículos para agregar
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {cart.map((item, idx) => {
                        const hasDiscount = item.descuento_pct > 0;
                        const subtotalLine = item.precio_unitario_final * item.cantidad;
                        return (
                          <div
                            key={item.articulo_id}
                            className={`relative flex items-center gap-2 py-2.5 ${
                              idx < cart.length - 1 ? 'border-b border-kp-border' : ''
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-kp-white truncate leading-tight">
                                {item.nombre}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-kp-gray">{item.codigo}</span>
                                {hasDiscount && (
                                  <>
                                    <span className="text-[10px] text-kp-gray line-through tabular-nums">
                                      {ars.format(item.precio_lista)}
                                    </span>
                                    <span className="text-[10px] font-semibold text-kp-red bg-kp-red/10
                                      border border-kp-red/20 rounded px-1 py-0.5 leading-none">
                                      -{item.descuento_pct.toFixed(1)}%
                                    </span>
                                    <span className="text-[10px] text-kp-white tabular-nums">
                                      {ars.format(item.precio_unitario_final)}
                                    </span>
                                  </>
                                )}
                                {!hasDiscount && (
                                  <span className="text-[10px] text-kp-gray tabular-nums">
                                    {ars.format(item.precio_unitario_final)} c/u
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                onClick={() => updateQty(item.articulo_id, -1)}
                                className="w-7 h-7 rounded-l border border-kp-border text-kp-gray hover:text-kp-white
                                  hover:bg-kp-surface2 flex items-center justify-center text-sm leading-none
                                  transition-colors"
                                aria-label="Reducir cantidad"
                              >
                                −
                              </button>
                              <NumericInput
                                decimals={0}
                                value={item.cantidad === 0 ? '' : item.cantidad}
                                onChange={e => setQty(item.articulo_id, e.target.value)}
                                onBlur={() => commitQty(item.articulo_id)}
                                className={[
                                  'w-14 text-center text-sm font-semibold tabular-nums',
                                  'bg-kp-surface2 border-y border-kp-border outline-none py-1',
                                  'focus:border-kp-red focus:bg-kp-surface transition-colors',
                                  item.stock_disponible > 0 && item.cantidad > item.stock_disponible
                                    ? 'text-amber-400'
                                    : 'text-kp-white',
                                ].join(' ')}
                                aria-label="Cantidad"
                              />
                              <button
                                onClick={() => updateQty(item.articulo_id, 1)}
                                className="w-7 h-7 rounded-r border border-kp-border text-kp-gray hover:text-kp-white
                                  hover:bg-kp-surface2 flex items-center justify-center text-sm leading-none
                                  transition-colors"
                                aria-label="Aumentar cantidad"
                              >
                                +
                              </button>
                            </div>
                            {item.stock_disponible > 0 && item.cantidad > item.stock_disponible && (
                              <span className="text-[9px] text-amber-400 font-semibold absolute -bottom-3.5 right-10 whitespace-nowrap">
                                Stock: {item.stock_disponible}
                              </span>
                            )}

                            <div className="w-24 text-right shrink-0">
                              <span className="text-sm font-semibold text-kp-white tabular-nums">
                                {ars.format(subtotalLine)}
                              </span>
                            </div>

                            <button
                              onClick={() => removeFromCart(item.articulo_id)}
                              className="w-7 h-7 flex items-center justify-center rounded text-kp-gray
                                hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                              aria-label={`Eliminar ${item.nombre}`}
                              title="Quitar artículo"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6"/><path d="M14 11v6"/>
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ══ RIGHT PANEL — Resumen ════════════════════════════════ */}
              <div className="w-80 shrink-0 border-l border-kp-border bg-kp-surface2 flex flex-col overflow-hidden">

                {selectedClient && (
                  <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-kp-surface border-b border-kp-border">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-amber-400 flex-shrink-0">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span className="text-xs font-semibold text-amber-400 truncate">{selectedClient.razon_social}</span>
                    {descuentoCliente > 0 && (
                      <span className="ml-auto text-xs text-kp-red font-bold flex-shrink-0">−{descuentoCliente}%</span>
                    )}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-5 space-y-5">

                  {/* ── Cliente ─────────────────────────────────────────── */}
                  <section>
                    <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-2.5">
                      Cliente
                    </p>

                    <div className="flex rounded-lg border border-kp-border overflow-hidden mb-3">
                      {(['publico', 'especifico'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => {
                            setClientMode(mode);
                            if (mode === 'publico') {
                              setSelectedClient(null);
                              setClientQuery('');
                              setClientResults([]);
                              setClientDropOpen(false);
                            }
                          }}
                          className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${
                            clientMode === mode
                              ? 'bg-kp-red text-white'
                              : 'text-kp-gray hover:text-kp-white hover:bg-kp-surface'
                          }`}
                        >
                          {mode === 'publico' ? 'Público General' : 'Cliente Específico'}
                        </button>
                      ))}
                    </div>

                    {clientMode === 'especifico' && (
                      <div className="relative" ref={clientDropRef}>
                        <div className="relative">
                          <input
                            type="text"
                            value={clientQuery}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                              setClientQuery(e.target.value);
                              setSelectedClient(null);
                            }}
                            placeholder="Buscar cliente…"
                            className="bg-kp-surface border border-kp-border focus:border-kp-red rounded-lg
                              px-3 py-2 text-sm w-full text-kp-white placeholder:text-kp-gray
                              outline-none transition-colors pr-8"
                            autoComplete="off"
                          />
                          {clientLoading && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Spinner />
                            </span>
                          )}
                        </div>

                        {clientDropOpen && clientResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 z-10
                            bg-kp-surface border border-kp-border rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                            {clientResults.map(cli => (
                              <button
                                key={cli.id}
                                onClick={() => {
                                  setSelectedClient(cli);
                                  setClientQuery(cli.razon_social);
                                  setClientDropOpen(false);
                                }}
                                className="w-full text-left px-3 py-2.5 hover:bg-kp-surface2 transition-colors border-b border-kp-border last:border-0"
                              >
                                <p className="text-sm text-kp-white font-medium truncate">
                                  {cli.razon_social}
                                </p>
                                {cli.lista_precio && (
                                  <p className="text-[10px] text-kp-gray mt-0.5">
                                    Lista: {cli.lista_precio}
                                    {cli.descuento_adicional > 0 && ` · Dto. ${cli.descuento_adicional}%`}
                                  </p>
                                )}
                              </button>
                            ))}
                          </div>
                        )}

                        {clientQuery.trim() && !clientLoading && clientResults.length === 0 && (
                          <p className="text-xs text-kp-gray mt-1.5 px-1">
                            Sin resultados
                          </p>
                        )}

                        {selectedClient && (
                          <div className="mt-2 rounded-lg bg-kp-surface border border-kp-border px-3 py-2.5">
                            <p className="text-xs font-semibold text-kp-white truncate">
                              {selectedClient.razon_social}
                            </p>
                            {selectedClient.lista_precio && (
                              <p className="text-[10px] text-kp-gray mt-0.5">
                                Lista: {selectedClient.lista_precio}
                              </p>
                            )}
                            {selectedClient.descuento_adicional > 0 && (
                              <p className="text-[10px] text-kp-red font-semibold mt-0.5">
                                Dto. adicional: {selectedClient.descuento_adicional}%
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  {/* ── Lista de precios ────────────────────────────────── */}
                  <section>
                    <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-2">
                      Lista de precios
                    </p>
                    <select
                      value={listaId}
                      onChange={e => setListaId(e.target.value)}
                      className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white
                        focus:outline-none focus:border-kp-red transition-colors"
                    >
                      <option value="">— Precio madre (sin lista)</option>
                      {listas.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.nombre}{l.descuento_lista > 0 ? ` (${l.descuento_lista}% dto.)` : ''}
                        </option>
                      ))}
                    </select>
                  </section>

                  {/* ── Discount breakdown ──────────────────────────────── */}
                  {(descuentoLista > 0 || descuentoCliente > 0) && (
                    <section className="rounded-lg bg-kp-surface border border-kp-border px-3 py-2.5 space-y-1.5">
                      <p className="text-[10px] text-kp-gray uppercase tracking-widest mb-1">
                        Descuentos aplicados
                      </p>
                      {descuentoLista > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-kp-gray">Lista de precios</span>
                          <span className="text-xs text-kp-red font-semibold">−{descuentoLista}%</span>
                        </div>
                      )}
                      {descuentoCliente > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-kp-gray">Dto. adicional</span>
                          <span className="text-xs text-kp-red font-semibold">−{descuentoCliente}%</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-kp-border">
                        <span className="text-xs font-semibold text-kp-white">Total descuento</span>
                        <span className="text-xs text-kp-red font-bold">
                          −{calcCombinedDiscount(descuentoLista, descuentoCliente).toFixed(2)}%
                        </span>
                      </div>
                    </section>
                  )}

                  {/* ── Totals ─────────────────────────────────────────────── */}
                  <section className="rounded-xl bg-kp-surface border border-kp-border overflow-hidden">
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-kp-gray">Subtotal</span>
                        <span className="text-xs text-kp-gray-lt tabular-nums font-medium">
                          {ars.format(subtotalBruto)}
                        </span>
                      </div>
                      {descuentoTotal > 0.001 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-kp-red">Descuento</span>
                          <span className="text-xs text-kp-red tabular-nums font-semibold">
                            −{ars.format(descuentoTotal)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-4 py-3.5 bg-kp-surface2 border-t border-kp-border">
                      <span className="text-sm font-bold uppercase tracking-wide text-kp-white">
                        Total
                      </span>
                      <span className="text-xl font-bold text-kp-white tabular-nums">
                        {ars.format(subtotalFinal)}
                      </span>
                    </div>
                  </section>
                </div>

                {/* ── Action button ──────────────────────────────────────── */}
                <div className="p-5 space-y-2.5 border-t border-kp-border shrink-0">
                  {saveError && (
                    <p className="text-xs text-kp-red bg-kp-red/10 border border-kp-red/20 rounded-lg px-3 py-2">
                      {saveError}
                    </p>
                  )}

                  <button
                    onClick={handleSave}
                    disabled={cartEmpty || saving}
                    className="w-full bg-kp-red hover:bg-kp-red-dark text-white font-semibold px-4 py-2.5 rounded-lg
                      transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed
                      shadow-lg shadow-kp-red/20"
                  >
                    {saving ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner /> Guardando…
                      </span>
                    ) : (
                      'Guardar Presupuesto'
                    )}
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
