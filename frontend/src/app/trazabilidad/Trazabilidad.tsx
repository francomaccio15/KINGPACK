'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { fmtFecha } from '@/lib/dates';

// ─── API helper (mismo patrón que el resto de componentes cliente) ───────────
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

const fmtMoneda = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

const fmtNum = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 3 });

// ─── Estados de venta (mismo estilo que el listado de Ventas) ────────────────
const ESTADO_STYLE: Record<string, string> = {
  preventa:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
  confirmada: 'bg-green-500/10 text-green-400 border-green-500/30',
  facturada:  'bg-blue-500/10 text-blue-400 border-blue-500/30',
  anulada:    'bg-kp-border/30 text-kp-gray border-kp-border/50',
};
const ESTADO_LABEL: Record<string, string> = {
  preventa:   'Preventa',
  confirmada: 'Confirmada',
  facturada:  'Facturada',
  anulada:    'Anulada',
};

type Articulo = { id: string; codigo: string; nombre: string };

type Movimiento = {
  venta_id: string;
  numero: number;
  fecha: string;
  estado: keyof typeof ESTADO_LABEL;
  cantidad: string;
  precio_unitario_final: string;
  importe: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  sucursal_nombre: string | null;
  vendedor_nombre: string | null;
  vendedor_rol: string | null;
};

type Resumen = {
  cantidad_ventas: number;
  total_unidades: number;
  total_importe: number;
};

export default function Trazabilidad() {
  // Buscador de artículo
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState<Articulo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Artículo seleccionado + resultados
  const [articulo, setArticulo]     = useState<Articulo | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [resumen, setResumen]       = useState<Resumen | null>(null);
  const [cargando, setCargando]     = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Filtros
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [estado, setEstado]         = useState('');

  // ─── Búsqueda de artículo (debounced) ──────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setBuscando(false); return; }

    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query.trim(), limit: '30' });
        const r = await apiFetch(`/api/articulos?${params}`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        setResults(data.articulos ?? data ?? []);
        setDropOpen(true);
      } catch {
        setResults([]);
      } finally {
        setBuscando(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Cerrar dropdown al clickear fuera
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setDropOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // ─── Cargar ventas del artículo ────────────────────────────────────────────
  async function cargar(art: Articulo) {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.set('fecha_desde', fechaDesde);
      if (fechaHasta) params.set('fecha_hasta', fechaHasta);
      if (estado)     params.set('estado', estado);
      const r = await apiFetch(`/api/articulos/${art.id}/ventas?${params}`);
      if (!r.ok) throw new Error();
      const data = await r.json();
      setMovimientos(data.movimientos ?? []);
      setResumen(data.resumen ?? null);
    } catch {
      setError('No se pudieron cargar las ventas de este artículo.');
      setMovimientos([]);
      setResumen(null);
    } finally {
      setCargando(false);
    }
  }

  function seleccionar(art: Articulo) {
    setArticulo(art);
    setQuery(`${art.codigo} — ${art.nombre}`);
    setResults([]);
    setDropOpen(false);
    cargar(art);
  }

  // Re-cargar al cambiar filtros (si ya hay artículo)
  useEffect(() => {
    if (articulo) cargar(articulo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta, estado]);

  return (
    <div className="space-y-5">
      {/* ── Buscador ── */}
      <div ref={boxRef} className="relative max-w-2xl">
        <label className="block text-xs font-semibold uppercase tracking-wide text-kp-gray mb-1.5">
          Buscar artículo
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (articulo) { setArticulo(null); setMovimientos([]); setResumen(null); } }}
          onFocus={() => { if (results.length) setDropOpen(true); }}
          placeholder="Código o nombre (ej: bandeja 618)"
          className="w-full px-4 py-2.5 rounded-lg bg-kp-surface2 border border-kp-border text-kp-white placeholder:text-kp-gray/60 focus:outline-none focus:border-kp-red transition-colors"
        />
        {buscando && (
          <span className="absolute right-3 top-9 text-xs text-kp-gray">Buscando…</span>
        )}

        {dropOpen && results.length > 0 && (
          <ul className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-lg bg-kp-surface2 border border-kp-border shadow-xl">
            {results.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => seleccionar(a)}
                  className="w-full text-left px-4 py-2.5 hover:bg-kp-red/10 transition-colors flex items-center gap-3"
                >
                  <span className="font-mono text-xs text-kp-gray shrink-0">{a.codigo}</span>
                  <span className="text-sm text-kp-white truncate">{a.nombre}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {dropOpen && !buscando && query.trim() && results.length === 0 && (
          <div className="absolute z-30 mt-1 w-full rounded-lg bg-kp-surface2 border border-kp-border px-4 py-3 text-sm text-kp-gray">
            Sin resultados para “{query.trim()}”.
          </div>
        )}
      </div>

      {/* ── Artículo seleccionado + resumen + filtros ── */}
      {articulo && (
        <>
          <div className="rounded-xl border border-kp-border bg-kp-surface p-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-kp-gray">Artículo</p>
              <p className="text-base font-bold text-kp-white">
                <span className="font-mono text-kp-gray-lt mr-2">{articulo.codigo}</span>
                {articulo.nombre}
              </p>
            </div>
            {resumen && (
              <div className="flex flex-wrap gap-x-8 gap-y-3 ml-auto">
                <div>
                  <p className="text-xs uppercase tracking-wide text-kp-gray">Ventas</p>
                  <p className="text-lg font-bold text-kp-white">{resumen.cantidad_ventas}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-kp-gray">Unidades vendidas</p>
                  <p className="text-lg font-bold text-kp-white">{fmtNum(resumen.total_unidades)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-kp-gray">Importe</p>
                  <p className="text-lg font-bold text-kp-white">{fmtMoneda(resumen.total_importe)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-kp-gray mb-1.5">Desde</label>
              <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
                className="px-3 py-2 rounded-lg bg-kp-surface2 border border-kp-border text-kp-white focus:outline-none focus:border-kp-red" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-kp-gray mb-1.5">Hasta</label>
              <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
                className="px-3 py-2 rounded-lg bg-kp-surface2 border border-kp-border text-kp-white focus:outline-none focus:border-kp-red" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-kp-gray mb-1.5">Estado</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value)}
                className="px-3 py-2 rounded-lg bg-kp-surface2 border border-kp-border text-kp-white focus:outline-none focus:border-kp-red">
                <option value="">Todos</option>
                <option value="confirmada">Confirmada</option>
                <option value="facturada">Facturada</option>
                <option value="preventa">Preventa</option>
                <option value="anulada">Anulada</option>
              </select>
            </div>
            {(fechaDesde || fechaHasta || estado) && (
              <button
                type="button"
                onClick={() => { setFechaDesde(''); setFechaHasta(''); setEstado(''); }}
                className="px-3 py-2 rounded-lg border border-kp-border text-sm text-kp-gray-lt hover:text-kp-white hover:border-kp-red transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Tabla de movimientos ── */}
      {articulo && (
        <div className="rounded-xl border border-kp-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-kp-surface2 text-kp-gray">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Comprobante</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Vendedor</th>
                  <th className="px-4 py-3 font-semibold">Sucursal</th>
                  <th className="px-4 py-3 font-semibold text-right">Cantidad</th>
                  <th className="px-4 py-3 font-semibold text-right">Importe</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-kp-border">
                {cargando ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-kp-gray">Cargando…</td></tr>
                ) : error ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-red-400">{error}</td></tr>
                ) : movimientos.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-kp-gray">
                    Este artículo no aparece en ninguna venta con los filtros actuales.
                  </td></tr>
                ) : (
                  movimientos.map((m, i) => (
                    <tr key={`${m.venta_id}-${i}`} className={`hover:bg-kp-surface2/50 transition-colors ${m.estado === 'anulada' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap text-kp-gray-lt">{fmtFecha(m.fecha)}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-kp-white">#{m.numero}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ESTADO_STYLE[m.estado] ?? ''}`}>
                          {ESTADO_LABEL[m.estado] ?? m.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-kp-white">{m.cliente_nombre ?? <span className="text-kp-gray">Consumidor final</span>}</td>
                      <td className="px-4 py-3 text-kp-gray-lt">{m.vendedor_nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-kp-gray-lt whitespace-nowrap">{m.sucursal_nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-kp-white whitespace-nowrap">{fmtNum(parseFloat(m.cantidad))}</td>
                      <td className="px-4 py-3 text-right text-kp-white whitespace-nowrap">{fmtMoneda(parseFloat(m.importe))}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link href={`/ventas/${m.venta_id}`} className="text-kp-red hover:underline font-medium">
                          Ver venta
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Estado inicial ── */}
      {!articulo && (
        <div className="rounded-xl border border-dashed border-kp-border bg-kp-surface/40 p-10 text-center">
          <p className="text-kp-gray">
            Buscá un artículo por código o nombre para ver todas las ventas que lo incluyen.
          </p>
        </div>
      )}
    </div>
  );
}
