'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NumericInput from '@/components/NumericInput';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 });
const fmt = (n: number) => ars.format(n);

interface ItemVenta {
  articulo_id: string;
  nombre: string;
  codigo: string;
  cantidad: number;
  precio_lista: number;
  precio_madre?: number | string;
  descuento_pct: number;
  precio_unitario_final: number;
}

interface ArticuloResult {
  id: string;
  nombre: string;
  codigo: string;
  precio_madre: number;
  precio_lista: number;
  stock_total: number;
}

interface CartItem {
  articulo_id: string;
  nombre: string;
  codigo: string;
  cantidad: number;
  precio_lista: number;
  precio_madre: number;             // precio base — para el subtotal bruto del descuento extra
  descuento_manual: number | null; // % fijado a mano para ESTE ítem (null = hereda el de la venta)
  descuento_pct: number;
  precio_unitario_final: number;
}

interface MedioPago { id: string; nombre: string; }
interface PagoItem { medio_pago_id: string; monto: string; }

export default function EditarVentaForm({
  ventaId,
  itemsIniciales,
  pagosIniciales = [],
  ventaEstado,
  listaPrecioId,
  observacionesActuales,
  descuentoExtraPctInicial = 0,
  descuentoExtraMontoInicial = 0,
}: {
  ventaId: string;
  itemsIniciales: ItemVenta[];
  pagosIniciales?: { medio_pago: string; monto: string; }[];
  ventaEstado?: string;
  listaPrecioId: string | null;
  observacionesActuales: string;
  descuentoExtraPctInicial?: number;
  descuentoExtraMontoInicial?: number;
}) {
  const router = useRouter();

  // Cart inicializado con los items actuales
  const [cart, setCart] = useState<CartItem[]>(
    itemsIniciales.map(i => {
      const saved = parseFloat(String(i.descuento_pct)) || 0;
      const lista = parseFloat(String(i.precio_lista)) || 0;
      return {
        articulo_id: i.articulo_id,
        nombre: i.nombre,
        codigo: i.codigo,
        cantidad: parseFloat(String(i.cantidad)),
        precio_lista: lista,
        precio_madre: parseFloat(String(i.precio_madre ?? lista)) || lista,
        descuento_manual: saved, // los ítems existentes muestran su descuento explícito
        descuento_pct: saved,
        precio_unitario_final: parseFloat(String(i.precio_unitario_final)),
      };
    })
  );

  // Descuento por defecto para artículos nuevos = primer ítem con descuento > 0
  const descuentoVenta = itemsIniciales.find(
    i => parseFloat(String(i.descuento_pct)) > 0
  )?.descuento_pct
    ? parseFloat(String(itemsIniciales.find(i => parseFloat(String(i.descuento_pct)) > 0)!.descuento_pct))
    : 0;

  const [observacion, setObservacion] = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // Descuento extra a nivel venta (renglón propio, NO se reparte en los ítems).
  const [descExtraModo, setDescExtraModo] = useState<'pct' | 'monto'>(
    descuentoExtraPctInicial > 0 || descuentoExtraMontoInicial <= 0 ? 'pct' : 'monto'
  );
  const [descExtraStr, setDescExtraStr] = useState<string>(
    descuentoExtraPctInicial > 0
      ? String(descuentoExtraPctInicial)
      : descuentoExtraMontoInicial > 0 ? String(descuentoExtraMontoInicial) : ''
  );

  // Medios de pago (solo para ventas confirmadas)
  const esConfirmada = ventaEstado === 'confirmada' || ventaEstado === 'facturada';
  const [mediosPago, setMediosPago]   = useState<MedioPago[]>([]);
  const [pagos, setPagos]             = useState<PagoItem[]>(
    pagosIniciales.length > 0
      ? pagosIniciales.map(p => ({ medio_pago_id: '', monto: String(parseFloat(p.monto) || '') }))
      : []
  );
  const [editarPagos, setEditarPagos] = useState(false);

  useEffect(() => {
    if (!esConfirmada) return;
    apiFetch('/api/ventas/medios-pago')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const lista: MedioPago[] = d.medios_pago ?? [];
        setMediosPago(lista);
        // Mapear pagos iniciales a IDs
        if (pagosIniciales.length > 0) {
          setPagos(pagosIniciales.map(p => {
            const mp = lista.find(m => m.nombre === p.medio_pago);
            return { medio_pago_id: mp?.id ?? '', monto: String(parseFloat(p.monto) || '') };
          }));
        }
      })
      .catch(() => {});
  }, [esConfirmada]);

  const agregarPago = () => {
    const primero = mediosPago[0]?.id ?? '';
    setPagos(prev => [...prev, { medio_pago_id: primero, monto: '' }]);
  };

  const actualizarPago = (idx: number, field: keyof PagoItem, val: string) => {
    setPagos(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  };

  const eliminarPago = (idx: number) => {
    setPagos(prev => prev.filter((_, i) => i !== idx));
  };

  const totalPagos = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);

  // Buscador de artículos
  const [query, setQuery]           = useState('');
  const [resultados, setResultados] = useState<ArticuloResult[]>([]);
  const [buscando, setBuscando]     = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  const buscar = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResultados([]); return; }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const listaParam = listaPrecioId ? `&lista_id=${listaPrecioId}` : '';
        const res = await apiFetch(`/api/articulos?q=${encodeURIComponent(q)}&activo=true&limit=8${listaParam}`);
        const data = await res.json();
        setResultados(data.articulos ?? []);
      } finally { setBuscando(false); }
    }, 300);
  }, []);

  const agregarArticulo = (art: ArticuloResult) => {
    setCart(prev => {
      const existe = prev.find(i => i.articulo_id === art.id);
      if (existe) {
        return prev.map(i => i.articulo_id === art.id
          ? { ...i, cantidad: i.cantidad + 1, precio_unitario_final: +(i.precio_lista * (1 - i.descuento_pct / 100)).toFixed(4) }
          : i
        );
      }
      // Ítem nuevo: hereda el descuento de la venta (descuento_manual = null).
      const precioLista = art.precio_madre || art.precio_lista;
      const eff = descuentoVenta;
      const precioFinal = +(precioLista * (1 - eff / 100)).toFixed(4);
      return [...prev, {
        articulo_id: art.id, nombre: art.nombre, codigo: art.codigo,
        cantidad: 1, precio_lista: precioLista,
        precio_madre: art.precio_madre || precioLista,
        descuento_manual: null, descuento_pct: eff,
        precio_unitario_final: precioFinal,
      }];
    });
    setQuery('');
    setResultados([]);
  };

  const actualizarCantidad = (articulo_id: string, val: string) => {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) return;
    setCart(prev => prev.map(i => i.articulo_id === articulo_id ? { ...i, cantidad: n } : i));
  };

  // Vacío = el ítem vuelve a heredar el descuento de la venta.
  const actualizarDescuento = (articulo_id: string, raw: string) => {
    let manual: number | null;
    if (raw.trim() === '') {
      manual = null;
    } else {
      const v = parseFloat(raw.replace(',', '.'));
      manual = isNaN(v) ? null : Math.min(100, Math.max(0, v));
    }
    setCart(prev => prev.map(i => {
      if (i.articulo_id !== articulo_id) return i;
      const eff = manual != null ? manual : descuentoVenta;
      return {
        ...i,
        descuento_manual: manual,
        descuento_pct: eff,
        precio_unitario_final: +(i.precio_lista * (1 - eff / 100)).toFixed(4),
      };
    }));
  };

  const eliminarItem = (articulo_id: string) => {
    setCart(prev => prev.filter(i => i.articulo_id !== articulo_id));
  };

  // Subtotal de los ítems (con su descuento de lista/cliente/ítem, sin el extra).
  const subtotalItems = cart.reduce((s, i) => s + i.precio_unitario_final * i.cantidad, 0);
  // Subtotal bruto (precio madre) — base del descuento extra en %.
  const subtotalBruto = cart.reduce((s, i) => s + i.precio_madre * i.cantidad, 0);

  // ── Descuento extra a nivel venta ──────────────────────────────────────────
  const descExtraInput = parseFloat(descExtraStr.replace(',', '.')) || 0;
  const extraPctPts    = descExtraModo === 'pct' ? Math.min(100, Math.max(0, descExtraInput)) : 0;
  const extraMontoFijo = descExtraModo === 'monto' && subtotalItems > 0
    ? Math.min(subtotalItems, Math.max(0, descExtraInput))
    : 0;
  const descExtraMonto = descExtraModo === 'pct'
    ? Math.min(subtotalItems, +(subtotalBruto * extraPctPts / 100).toFixed(2))
    : extraMontoFijo;
  const subtotal = +(subtotalItems - descExtraMonto).toFixed(2); // total final con extra

  const guardar = async () => {
    if (cart.length === 0) { setError('Agregá al menos un artículo.'); return; }
    if (!observacion.trim()) { setError('El motivo de la edición es obligatorio.'); return; }

    // Validar pagos si se editaron
    if (editarPagos && pagos.length > 0) {
      const invalido = pagos.some(p => !p.medio_pago_id || !parseFloat(p.monto));
      if (invalido) { setError('Completá todos los métodos de pago y montos.'); return; }
    }

    setSaving(true);
    setError('');
    try {
      const body: any = {
        items: cart,
        observacion: observacion.trim(),
        descuento_extra_pct:   extraPctPts,
        descuento_extra_monto: descExtraModo === 'monto' ? extraMontoFijo : descExtraMonto,
      };
      if (editarPagos && pagos.length > 0) {
        body.pagos = pagos.map(p => ({ medio_pago_id: p.medio_pago_id, monto: parseFloat(p.monto) }));
      }
      const res = await apiFetch(`/api/ventas/${ventaId}/items`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      router.push(`/ventas/${ventaId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* ── Buscador de artículos ── */}
      <div className="rounded-xl border border-kp-border bg-kp-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Agregar artículo</h3>
          {descuentoVenta > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-kp-red/10 border border-kp-red/30 text-kp-red rounded-lg px-2 py-0.5">
              Nuevos con {descuentoVenta}% dto.
            </span>
          )}
        </div>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); buscar(e.target.value); }}
            placeholder="Buscar por nombre o código..."
            className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-4 py-2.5 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors"
          />
          {buscando && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-kp-red/30 border-t-kp-red rounded-full animate-spin" />
            </div>
          )}
          {resultados.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-kp-surface2 border border-kp-border rounded-lg shadow-xl overflow-hidden">
              {resultados.map(art => (
                <button
                  key={art.id}
                  onClick={() => agregarArticulo(art)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-kp-surface text-left transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-kp-white group-hover:text-kp-red transition-colors">{art.nombre}</p>
                    <p className="text-xs text-kp-gray font-mono">{art.codigo}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-sm font-bold text-kp-white">{fmt(art.precio_lista || art.precio_madre)}</p>
                    <p className="text-xs text-kp-gray">Stock: {art.stock_total ?? '—'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Descuento extra a toda la venta ── */}
      <div className="rounded-xl border border-kp-border bg-kp-surface p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Descuento extra</h3>
            <p className="text-xs text-kp-gray mt-1">Se descuenta del total de la venta, aparte del descuento de cada artículo.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex rounded-md border border-kp-border overflow-hidden">
              {(['pct', 'monto'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDescExtraModo(m)}
                  className={`px-2.5 py-1 text-xs font-bold transition-colors ${
                    descExtraModo === m ? 'bg-kp-red text-white' : 'text-kp-gray hover:text-kp-white'
                  }`}
                  aria-label={m === 'pct' ? 'Descuento en porcentaje' : 'Descuento en pesos'}
                >
                  {m === 'pct' ? '%' : '$'}
                </button>
              ))}
            </div>
            <div className="flex items-center">
              <NumericInput
                decimals={2}
                placeholder={descExtraModo === 'pct' ? '0' : '0,00'}
                value={descExtraStr}
                onChange={e => setDescExtraStr(e.target.value)}
                className={`w-24 text-center bg-kp-surface2 border rounded-l px-2 py-1.5 text-sm tabular-nums focus:outline-none transition-colors ${
                  descExtraMonto > 0 ? 'border-kp-red text-kp-red font-semibold' : 'border-kp-border text-kp-white focus:border-kp-red'
                }`}
                aria-label="Descuento extra"
              />
              <span className="px-2 py-1.5 text-xs text-kp-gray bg-kp-surface2 border border-l-0 border-kp-border rounded-r leading-none">
                {descExtraModo === 'pct' ? '%' : '$'}
              </span>
            </div>
          </div>
        </div>
        {descExtraMonto > 0 && (
          <p className="text-xs text-kp-red font-semibold mt-3">
            Descontando {fmt(descExtraMonto)} del total{descExtraModo === 'pct' ? ` (${extraPctPts}% del subtotal)` : ''}.
          </p>
        )}
      </div>

      {/* ── Carrito ── */}
      <div className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden">
        <div className="bg-kp-surface2 px-5 py-3 border-b border-kp-border flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">
            Artículos ({cart.length})
          </h3>
          <span className="text-xs text-kp-gray">Total: <span className="text-kp-white font-bold">{fmt(subtotal)}</span></span>
        </div>

        {cart.length === 0 ? (
          <div className="px-5 py-10 text-center text-kp-gray text-sm">
            No hay artículos. Usá el buscador para agregar.
          </div>
        ) : (
          <div className="divide-y divide-kp-border">
            {cart.map(item => (
              <div key={item.articulo_id} className="px-5 py-3 flex items-center gap-3 hover:bg-kp-surface2 transition-colors">

                {/* Info artículo */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-kp-white truncate">{item.nombre}</p>
                  <p className="text-xs text-kp-gray font-mono">{item.codigo}</p>
                </div>

                {/* Cantidad */}
                <div className="flex flex-col items-center gap-0.5">
                  <label className="text-[10px] text-kp-gray uppercase tracking-widest">Cant.</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.cantidad}
                    onChange={e => actualizarCantidad(item.articulo_id, e.target.value)}
                    className="w-16 text-center bg-kp-surface2 border border-kp-border rounded px-2 py-1 text-sm text-kp-white focus:outline-none focus:border-kp-red"
                  />
                </div>

                {/* Descuento */}
                <div className="flex flex-col items-center gap-0.5" title="Descuento de este artículo (%). Vacío = hereda el de la venta.">
                  <label className="text-[10px] text-kp-gray uppercase tracking-widest">Desc.</label>
                  <div className="flex items-center">
                    <NumericInput
                      decimals={1}
                      placeholder={descuentoVenta > 0 ? String(descuentoVenta) : '0'}
                      value={item.descuento_manual != null ? item.descuento_manual : ''}
                      onChange={e => actualizarDescuento(item.articulo_id, e.target.value)}
                      className={`w-12 text-center bg-kp-surface2 border rounded-l px-2 py-1 text-sm tabular-nums focus:outline-none transition-colors ${
                        item.descuento_pct > 0
                          ? 'border-kp-red text-kp-red font-semibold focus:border-kp-red'
                          : 'border-kp-border text-kp-white focus:border-kp-red'
                      }`}
                      aria-label={`Descuento de ${item.nombre}`}
                    />
                    <span className="px-1.5 py-1 text-xs text-kp-gray bg-kp-surface2 border border-l-0 border-kp-border rounded-r leading-none">%</span>
                  </div>
                </div>

                {/* Precio final */}
                <div className="text-right min-w-[90px]">
                  <p className="text-xs text-kp-gray">c/u</p>
                  <p className="text-sm font-semibold text-kp-white tabular-nums">{fmt(item.precio_unitario_final)}</p>
                </div>

                {/* Subtotal */}
                <div className="text-right min-w-[100px]">
                  <p className="text-xs text-kp-gray">subtotal</p>
                  <p className="text-sm font-bold text-kp-white tabular-nums">{fmt(item.precio_unitario_final * item.cantidad)}</p>
                </div>

                {/* Eliminar */}
                <button
                  onClick={() => eliminarItem(item.articulo_id)}
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-kp-gray hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Quitar artículo"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        {cart.length > 0 && (
          <div className="border-t border-kp-border bg-kp-surface2 px-5 py-3 flex justify-end">
            <div className="text-right space-y-1 min-w-[220px]">
              {descExtraMonto > 0 && (
                <>
                  <div className="flex justify-between text-xs text-kp-gray">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{fmt(subtotalItems)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-kp-gray">Descuento extra{descExtraModo === 'pct' ? ` ${extraPctPts}%` : ''}</span>
                    <span className="text-kp-red font-semibold tabular-nums">−{fmt(descExtraMonto)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-xs text-kp-gray uppercase tracking-widest">Total</span>
                <span className="text-2xl font-bold text-kp-white tabular-nums">{fmt(subtotal)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Medios de pago (solo ventas confirmadas) ── */}
      {esConfirmada && (
        <div className="rounded-xl border border-kp-border bg-kp-surface overflow-hidden">
          <div className="bg-kp-surface2 px-5 py-3 border-b border-kp-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-kp-gray">Medios de Pago</h3>
              {pagosIniciales.length > 0 && !editarPagos && (
                <span className="text-xs text-kp-gray">
                  {pagosIniciales.map(p => `${p.medio_pago} ${fmt(parseFloat(p.monto) || 0)}`).join(' · ')}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setEditarPagos(!editarPagos); if (!editarPagos && pagos.length === 0) agregarPago(); }}
              className={`text-xs font-semibold px-3 py-1 rounded-lg border transition-colors ${
                editarPagos
                  ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                  : 'border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray'
              }`}
            >
              {editarPagos ? 'Cancelar edición' : 'Editar pagos'}
            </button>
          </div>

          {editarPagos && (
            <div className="p-5 space-y-3">
              {pagos.map((pago, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <select
                    value={pago.medio_pago_id}
                    onChange={e => actualizarPago(idx, 'medio_pago_id', e.target.value)}
                    className="flex-1 bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red"
                  >
                    <option value="">— Seleccionar —</option>
                    {mediosPago.map(mp => (
                      <option key={mp.id} value={mp.id}>{mp.nombre}</option>
                    ))}
                  </select>
                  <div className="relative w-36">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kp-gray text-xs">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pago.monto}
                      onChange={e => actualizarPago(idx, 'monto', e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-kp-surface2 border border-kp-border rounded-lg pl-6 pr-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminarPago(idx)}
                    className="text-kp-gray hover:text-rose-400 transition-colors p-1"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ))}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={agregarPago}
                  className="text-xs text-kp-red hover:text-red-400 font-semibold transition-colors flex items-center gap-1"
                >
                  + Agregar método
                </button>
                {pagos.length > 0 && totalPagos > 0 && (
                  <div className={`text-xs font-semibold px-3 py-1 rounded-lg border ${
                    Math.abs(totalPagos - subtotal) < 0.01
                      ? 'text-green-400 border-green-500/30 bg-green-500/10'
                      : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                  }`}>
                    Total pagos: {fmt(totalPagos)} / {fmt(subtotal)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Motivo de edición (obligatorio) ── */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-amber-400 flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400">
            Motivo de la edición <span className="text-rose-400">*</span>
          </h3>
        </div>
        <textarea
          value={observacion}
          onChange={e => setObservacion(e.target.value)}
          rows={3}
          placeholder="Ej: Error de tipeo, cambio solicitado por el cliente, producto incorrecto…"
          className="w-full bg-kp-surface border border-kp-border rounded-lg px-4 py-3 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-amber-400 resize-none transition-colors"
        />
        <p className="text-xs text-kp-gray">Este motivo quedará registrado en el historial de la venta y será visible para los administradores.</p>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-kp-red/40 bg-kp-red/10 px-4 py-3 text-sm text-kp-red">
          {error}
        </div>
      )}

      {/* ── Botones ── */}
      <div className="flex items-center gap-3 justify-end">
        <a
          href={`/ventas/${ventaId}`}
          className="px-5 py-2.5 rounded-lg border border-kp-border bg-kp-surface text-kp-gray hover:text-kp-white hover:bg-kp-surface2 text-sm font-medium transition-colors"
        >
          Cancelar
        </a>
        <button
          onClick={guardar}
          disabled={saving || cart.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-kp-red text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Guardando…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              Guardar cambios
            </>
          )}
        </button>
      </div>
    </div>
  );
}
