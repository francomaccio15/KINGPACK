'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
};

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const fmt = (n: number) => ars.format(n);

interface ItemVenta {
  articulo_id: string;
  nombre: string;
  codigo: string;
  cantidad: number;
  precio_lista: number;
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
  descuento_pct: number;
  precio_unitario_final: number;
}

export default function EditarVentaForm({
  ventaId,
  itemsIniciales,
  listaPrecioId,
  observacionesActuales,
}: {
  ventaId: string;
  itemsIniciales: ItemVenta[];
  listaPrecioId: string | null;
  observacionesActuales: string;
}) {
  const router = useRouter();

  // Cart inicializado con los items actuales
  const [cart, setCart] = useState<CartItem[]>(
    itemsIniciales.map(i => ({
      articulo_id: i.articulo_id,
      nombre: i.nombre,
      codigo: i.codigo,
      cantidad: parseFloat(String(i.cantidad)),
      precio_lista: parseFloat(String(i.precio_lista)),
      descuento_pct: parseFloat(String(i.descuento_pct)) || 0,
      precio_unitario_final: parseFloat(String(i.precio_unitario_final)),
    }))
  );

  // Nuevos artículos se agregan con el precio de la lista original de la venta (descuento_pct = 0)
  // El precio ya viene correcto desde la API con lista_id

  const [observacion, setObservacion] = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

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
      // El precio ya viene de la lista seleccionada — descuento_pct = 0
      const precioLista = art.precio_lista || art.precio_madre;
      return [...prev, {
        articulo_id: art.id, nombre: art.nombre, codigo: art.codigo,
        cantidad: 1, precio_lista: precioLista, descuento_pct: 0,
        precio_unitario_final: precioLista,
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

  const actualizarDescuento = (articulo_id: string, val: string) => {
    const pct = Math.max(0, Math.min(100, parseFloat(val) || 0));
    setCart(prev => prev.map(i => i.articulo_id === articulo_id
      ? { ...i, descuento_pct: pct, precio_unitario_final: +(i.precio_lista * (1 - pct / 100)).toFixed(4) }
      : i
    ));
  };

  const eliminarItem = (articulo_id: string) => {
    setCart(prev => prev.filter(i => i.articulo_id !== articulo_id));
  };

  const subtotal = cart.reduce((s, i) => s + i.precio_unitario_final * i.cantidad, 0);

  const guardar = async () => {
    if (cart.length === 0) { setError('Agregá al menos un artículo.'); return; }
    if (!observacion.trim()) { setError('El motivo de la edición es obligatorio.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(`/api/ventas/${ventaId}/items`, {
        method: 'PUT',
        body: JSON.stringify({ items: cart, observacion: observacion.trim() }),
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
          {listaPrecioId && (
            <span className="text-xs text-kp-gray">Precios de la lista original de la venta</span>
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
                <div className="flex flex-col items-center gap-0.5">
                  <label className="text-[10px] text-kp-gray uppercase tracking-widest">Desc. %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={item.descuento_pct}
                    onChange={e => actualizarDescuento(item.articulo_id, e.target.value)}
                    className={`w-16 text-center bg-kp-surface2 border rounded px-2 py-1 text-sm focus:outline-none transition-colors ${
                      item.descuento_pct > 0
                        ? 'border-kp-red text-kp-red font-semibold focus:border-kp-red'
                        : 'border-kp-border text-kp-white focus:border-kp-red'
                    }`}
                  />
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
            <div className="text-right">
              <p className="text-xs text-kp-gray uppercase tracking-widest">Total</p>
              <p className="text-2xl font-bold text-kp-white tabular-nums">{fmt(subtotal)}</p>
            </div>
          </div>
        )}
      </div>

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
