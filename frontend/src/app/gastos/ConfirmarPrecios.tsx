'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import NumericInput from '@/components/NumericInput';

/**
 * Aviso previo a guardar una compra de mercadería.
 *
 * Cargar una compra pisa el costo de cada artículo y, por el trigger de precios,
 * también su precio de venta y las listas. Antes eso pasaba en silencio: acá se
 * muestra artículo por artículo cómo queda, y se puede aceptar, corregir el
 * costo o el precio de venta a mano, o dejar alguno sin tocar.
 *
 * Las decisiones viajan en cada ítem del egreso (`actualizar_costo`,
 * `costo_nuevo`, `precio_venta_nuevo`).
 */

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => { const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null; return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } }); };
const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 });
const arsEnteros = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

/** Una línea de la compra, ya con el costo que saldría de ella. */
export interface LineaPrecio {
  articulo_id: string;
  descripcion: string;
  /** Costo efectivo de la compra: precio unitario × dto. línea × bonificaciones. */
  costo_calculado: number;
}

/** Lo que el usuario decidió para un artículo. */
export interface DecisionPrecio {
  actualizar: boolean;
  costo: number;
  precio_venta: number;
}

interface ArticuloCosto {
  id: string;
  codigo: string;
  nombre: string;
  costo_base: number;
  costo_flete: number;
  precio_madre: number;
  margen_efectivo: number;
  alicuota_porcentaje: number;
}

interface Fila {
  articulo_id: string;
  codigo: string;
  nombre: string;
  costoActual: number | null;
  precioActual: number | null;
  costoCalculado: number;
  actualizar: boolean;
  costo: string;
  precioVenta: string;
}

/**
 * Precio de venta que dejaría el trigger para un costo dado. Replica
 * fn_calcular_precio_madre: costo × (1+flete%) × (1+margen%) × (1+IVA%),
 * redondeado a pesos enteros (migración 025).
 *
 * Con flete de la compra, el margen se reajusta para no mover el precio final
 * — mismo criterio que `aplicarCostoDeCompra` en el backend.
 */
function precioAuto(costo: number, art: ArticuloCosto | undefined, fletePct: number): number {
  if (!art) return 0;
  const factorViejo = (1 + (art.costo_flete || 0) / 100) * (1 + (art.margen_efectivo || 0) / 100);
  const fleteFinal  = fletePct > 0 ? fletePct : (art.costo_flete || 0);
  const margenFinal = fletePct > 0
    ? +(((factorViejo / (1 + fletePct / 100)) - 1) * 100).toFixed(2)
    : (art.margen_efectivo || 0);
  const precio = costo * (1 + fleteFinal / 100) * (1 + margenFinal / 100)
                       * (1 + (art.alicuota_porcentaje || 0) / 100);
  return Math.round(precio);
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/** Variación porcentual, para el cartelito de al lado del precio. */
function Delta({ desde, hasta }: { desde: number | null; hasta: number }) {
  if (!desde || desde <= 0 || !hasta) return null;
  const pct = ((hasta - desde) / desde) * 100;
  if (Math.abs(pct) < 0.05) return <span className="text-2xs text-kp-gray">sin cambios</span>;
  const sube = pct > 0;
  return (
    <span className={`text-2xs font-semibold tabular-nums ${sube ? 'text-amber-400' : 'text-green-400'}`}>
      {sube ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export default function ConfirmarPrecios({
  open, lineas, fletePct, saving, onCancel, onConfirm,
}: {
  open: boolean;
  lineas: LineaPrecio[];
  fletePct: number;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (decisiones: Record<string, DecisionPrecio>) => void;
}) {
  const [arts,    setArts]    = useState<Record<string, ArticuloCosto>>({});
  const [filas,   setFilas]   = useState<Fila[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Ids de los artículos de la compra, en orden y sin repetir. Si un artículo
  // aparece en varias líneas vale la última, igual que en el backend.
  const ids = lineas.map(l => l.articulo_id).filter(Boolean);
  const idsKey = ids.join(',');

  useEffect(() => {
    if (!open || ids.length === 0) return;
    let cancelado = false;
    setLoading(true);
    setError(null);
    apiFetch(`/api/articulos/costos?ids=${encodeURIComponent(idsKey)}`)
      .then(r => r.json())
      .then((d: { articulos?: ArticuloCosto[] }) => {
        if (cancelado) return;
        const mapa: Record<string, ArticuloCosto> = {};
        for (const a of d.articulos ?? []) mapa[a.id] = a;
        setArts(mapa);

        // Última línea de cada artículo (la que manda) → una fila por artículo.
        const porArticulo = new Map<string, LineaPrecio>();
        for (const l of lineas) if (l.articulo_id) porArticulo.set(l.articulo_id, l);

        setFilas(Array.from(porArticulo.values()).map(l => {
          const art = mapa[l.articulo_id];
          const costo = l.costo_calculado;
          return {
            articulo_id:    l.articulo_id,
            codigo:         art?.codigo ?? '',
            nombre:         art?.nombre ?? l.descripcion,
            costoActual:    art ? art.costo_base : null,
            precioActual:   art ? art.precio_madre : null,
            costoCalculado: costo,
            actualizar:     true,
            costo:          costo > 0 ? String(costo) : '',
            precioVenta:    String(precioAuto(costo, art, fletePct)),
          };
        }));
      })
      .catch(() => { if (!cancelado) setError('No se pudieron leer los precios actuales'); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [open, idsKey, fletePct]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFila = (id: string, cambio: Partial<Fila>) =>
    setFilas(prev => prev.map(f => f.articulo_id === id ? { ...f, ...cambio } : f));

  // Al corregir el costo, el precio de venta sugerido se recalcula solo. Si
  // después se toca el precio, ese valor manda (se fija el margen que lo clava).
  const updCosto = (id: string, valor: string) => {
    const costo = parseFloat(valor) || 0;
    setFila(id, { costo: valor, precioVenta: String(precioAuto(costo, arts[id], fletePct)) });
  };

  const marcarTodos = (valor: boolean) =>
    setFilas(prev => prev.map(f => ({ ...f, actualizar: valor })));

  const aActualizar = filas.filter(f => f.actualizar).length;

  const confirmar = () => {
    const decisiones: Record<string, DecisionPrecio> = {};
    for (const f of filas) {
      decisiones[f.articulo_id] = {
        actualizar:   f.actualizar,
        costo:        parseFloat(f.costo) || 0,
        precio_venta: parseFloat(f.precioVenta) || 0,
      };
    }
    onConfirm(decisiones);
  };

  const labelCls = 'block text-2xs font-semibold uppercase tracking-widest text-kp-gray mb-1';
  const inputCls = 'w-full text-right bg-kp-surface border border-kp-border rounded px-2 py-1.5 text-sm text-kp-white focus:outline-none focus:border-kp-red disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onCancel}
      size="xl"
      title="Esta compra cambia precios"
      subtitle={
        filas.length > 0
          ? `${aActualizar} de ${filas.length} ${filas.length === 1 ? 'artículo se actualiza' : 'artículos se actualizan'} — revisá costo y precio de venta antes de guardar`
          : 'Revisá cómo queda cada artículo antes de guardar'
      }
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors disabled:opacity-50"
          >
            Volver a editar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={saving || loading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <><Spinner /> Guardando…</> : 'Confirmar y guardar'}
          </button>
        </>
      }
    >
      {loading && (
        <div className="flex items-center gap-2 text-sm text-kp-gray py-6 justify-center">
          <Spinner /> Leyendo precios actuales…
        </div>
      )}

      {error && (
        <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-3">{error}</p>
      )}

      {!loading && filas.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-kp-gray">
              Destildá un artículo para que conserve su costo y su precio de venta.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => marcarTodos(true)}
                className="text-2xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors">
                Actualizar todos
              </button>
              <button type="button" onClick={() => marcarTodos(false)}
                className="text-2xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors">
                Ninguno
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {filas.map(f => {
              const costoNum  = parseFloat(f.costo) || 0;
              const precioNum = parseFloat(f.precioVenta) || 0;
              return (
                <div
                  key={f.articulo_id}
                  className={`rounded-xl border p-3 transition-colors ${
                    f.actualizar ? 'border-kp-border bg-kp-surface2' : 'border-kp-border/50 bg-kp-surface2/40'
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={f.actualizar}
                      onChange={e => setFila(f.articulo_id, { actualizar: e.target.checked })}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-kp-red cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm font-medium truncate ${f.actualizar ? 'text-kp-white' : 'text-kp-gray'}`}>
                        {f.nombre}
                      </div>
                      {f.codigo && <div className="text-2xs font-mono text-kp-gray">{f.codigo}</div>}
                    </div>
                    {!f.actualizar && (
                      <span className="text-2xs uppercase tracking-widest text-kp-gray shrink-0">Sin tocar</span>
                    )}
                  </label>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Costo */}
                    <div>
                      <div className="flex items-baseline justify-between">
                        <label className={labelCls}>Costo</label>
                        <span className="text-2xs text-kp-gray tabular-nums">
                          Actual: {f.costoActual != null ? ars.format(f.costoActual) : '—'}
                        </span>
                      </div>
                      <NumericInput
                        decimals={3}
                        value={f.costo}
                        disabled={!f.actualizar}
                        onChange={e => updCosto(f.articulo_id, e.target.value)}
                        className={inputCls}
                      />
                      <div className="mt-1 text-right">
                        {f.actualizar
                          ? <Delta desde={f.costoActual} hasta={costoNum} />
                          : <span className="text-2xs text-kp-gray">queda como está</span>}
                      </div>
                    </div>

                    {/* Precio de venta */}
                    <div>
                      <div className="flex items-baseline justify-between">
                        <label className={labelCls}>Precio de venta</label>
                        <span className="text-2xs text-kp-gray tabular-nums">
                          Actual: {f.precioActual != null ? arsEnteros.format(f.precioActual) : '—'}
                        </span>
                      </div>
                      <NumericInput
                        decimals={0}
                        value={f.precioVenta}
                        disabled={!f.actualizar}
                        onChange={e => setFila(f.articulo_id, { precioVenta: e.target.value })}
                        className={inputCls}
                      />
                      <div className="mt-1 text-right">
                        {f.actualizar
                          ? <Delta desde={f.precioActual} hasta={precioNum} />
                          : <span className="text-2xs text-kp-gray">queda como está</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-2xs text-kp-gray leading-relaxed">
            El precio de venta se recalcula solo con el margen del artículo cuando cambia el costo.
            Si lo escribís a mano, se ajusta el margen para dejar ese precio exacto.
            Las listas con descuento se recalculan sobre el precio resultante.
          </p>
        </>
      )}
    </Modal>
  );
}
