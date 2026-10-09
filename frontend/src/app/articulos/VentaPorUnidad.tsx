'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import NumericInput from '@/components/NumericInput';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary, cn, errorCls, inputCls } from '@/lib/ui';
import { formatoStock } from '@/lib/unidades';

// Artículos → Venta por unidad (solo admin). Acá se tildan los artículos que se
// venden sueltos: son los ÚNICOS que muestran «+ Unidad» en ventas. Tildar uno
// que todavía está en bultos convierte su stock a unidades al instante;
// destildarlo solo saca el «+ Unidad» (el stock sigue en unidades).

type StockSuc = { sucursal: string; cantidad: string | number };
type Art = {
  id: string; codigo: string; nombre: string; categoria: string | null;
  vende_por_unidad: boolean; unidades_por_bulto: number;
  precio_unidad: string | null; precio_madre: string;
  stock: StockSuc[];
  factor_sugerido: number | null; confianza: 'alta' | 'revisar' | 'sin_dato';
};
type Filtro = 'inicial' | 'sugeridos' | 'habilitados' | 'todos';

// Lista inicial que pasó el negocio el 07/10/2026 (lo que la gente pide suelto):
// bandejas de aluminio, cajas de pizza y de lomo, bandejas de tergopol, bandejas
// redondas de cartón, vasos plásticos, bandejas 105, budinera de aluminio y potes.
// Es solo un filtro: cada artículo se habilita igual, tildándolo.
const LISTA_INICIAL = new Set([
  'KP00042', 'KP00043', 'KP00020', 'KP00021', 'KP00022', 'KP00044', 'KP00045', 'KP00046', 'KP00023', 'KP00024',
  'KP00144', 'KP00038', 'KP00037', 'KP00039',
  'KP00047', 'KP00048', 'KP00049', 'KP00025', 'KP00030',
  'KP00148', 'KP00149', 'KP00150', 'KP00184', 'KP00185', 'KP00186', 'KP00194',
  'KP00175', 'KP00176', 'KP00177', 'KP00192', 'KP00193',
  'KP00011', 'KP00012', 'KP00013', 'KP00014', 'KP00015',
  'KP00356', 'KP00357', 'KP00358', 'KP00359', 'KP00360', 'KP00361', 'KP00362', 'KP00363', 'KP00365', 'KP00364',
  // Potes (agregados el 09/10/2026): todos los que llevan "pote" en el nombre.
  'KP00207', 'KP00295', 'KP00296', 'KP00297', 'KP00298', 'KP00299', 'KP00300', 'KP00301',
  'KP00302', 'KP00303', 'KP00304', 'KP00305', 'KP00306', 'KP00307', 'KP00308', 'KP00309',
  '389', '390', '391', '392',
  // Tapas de potes (088, 1 kg y 088 ensobradas).
  '377', '378', '393',
]);

// Margen de la venta suelta para la Lista inicial (pedido del 09/10/2026): el
// precio por unidad es el del bulto prorrateado × 2 (100%), redondeado siempre
// para arriba a pesos enteros. El precio del bulto no cambia. Los que ya tenían
// bulto definido se actualizaron con la migración 065.
const MARGEN_UNIDAD_INICIAL = 1;
const precioUnidadInicial = (precioBulto: number, factor: number) =>
  Math.ceil(precioBulto / factor * (1 + MARGEN_UNIDAD_INICIAL));

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

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 });

const ETIQUETA_CONFIANZA: Record<Art['confianza'], { txt: string; cls: string }> = {
  alta:     { txt: '',                    cls: '' },
  revisar:  { txt: 'confirmar cantidad', cls: 'text-amber-400' },
  sin_dato: { txt: 'completar',          cls: 'text-kp-gray' },
};

function Fila({ art, onCambio }: { art: Art; onCambio: (a: Art) => void }) {
  const convertido = art.unidades_por_bulto > 1;
  const inicial = LISTA_INICIAL.has(art.codigo);
  const madre = parseFloat(art.precio_madre);
  const sugerido = (f: string) => {
    const n = parseInt(f, 10);
    return inicial && Number.isInteger(n) && n > 1 && madre > 0 ? String(precioUnidadInicial(madre, n)) : '';
  };
  const [factor, setFactor] = useState(String(convertido ? art.unidades_por_bulto : art.factor_sugerido ?? ''));
  const [precio, setPrecio] = useState(art.precio_unidad != null ? String(parseFloat(art.precio_unidad)) : sugerido(factor));
  // Mientras el precio sea el sugerido (no lo tocaron a mano), sigue al factor.
  const [precioManual, setPrecioManual] = useState(art.precio_unidad != null);
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const nFactor = parseInt(factor, 10);
  const nPrecio = parseFloat(precio);
  const factorOk = Number.isInteger(nFactor) && nFactor > 1 && String(nFactor) === factor.trim();
  const precioOk = Number.isFinite(nPrecio) && nPrecio > 0;
  const referencia = factorOk ? parseFloat(art.precio_madre) / nFactor : null;
  const precioCambio = precioOk && nPrecio !== (art.precio_unidad != null ? parseFloat(art.precio_unidad) : null);

  const llamar = async (url: string, method: string, body: object) => {
    setGuardando(true); setError('');
    try {
      const r = await apiFetch(url, { method, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'No se pudo guardar');
      onCambio({
        ...art,
        vende_por_unidad: d.articulo.vende_por_unidad,
        unidades_por_bulto: d.articulo.unidades_por_bulto,
        precio_unidad: d.articulo.precio_unidad != null ? String(d.articulo.precio_unidad) : null,
        // Si se convirtió, el stock que devuelve el backend ya está en unidades.
        stock: d.conversion
          ? art.stock.map(s => ({ ...s, cantidad: Number(s.cantidad) * d.articulo.unidades_por_bulto }))
          : art.stock,
      });
      setConfirmar(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const activar = () => llamar(`/api/articulos/${art.id}/activar-unidad`, 'POST', { unidades_por_bulto: nFactor, precio_unidad: nPrecio });
  const desactivar = () => llamar(`/api/articulos/${art.id}/venta-por-unidad`, 'PATCH', { vende_por_unidad: false, precio_unidad: precioOk ? nPrecio : null });
  const guardarPrecio = () => llamar(`/api/articulos/${art.id}/venta-por-unidad`, 'PATCH', { vende_por_unidad: true, precio_unidad: nPrecio });

  const onTilde = (marcar: boolean) => {
    setError('');
    if (!marcar) { desactivar(); return; }
    if (!factorOk) { setError('Cargá las unidades por bulto (entero mayor a 1)'); return; }
    if (!precioOk) { setError('Cargá el precio por unidad'); return; }
    setConfirmar(true);
  };

  const conf = ETIQUETA_CONFIANZA[art.confianza];
  const upbVista = convertido ? art.unidades_por_bulto : 1;

  return (
    <tr className={cn('border-b border-kp-border/40 align-top', art.vende_por_unidad && 'bg-sky-500/5')}>
      <td className="px-3 py-2.5">
        <input
          type="checkbox"
          checked={art.vende_por_unidad}
          disabled={guardando}
          onChange={e => onTilde(e.target.checked)}
          aria-label={`Vender ${art.nombre} por unidad`}
          className="w-5 h-5 md:w-4 md:h-4 mt-0.5 rounded border-kp-border bg-kp-surface2 text-kp-red cursor-pointer disabled:opacity-40"
        />
      </td>
      <td className="px-3 py-2.5 min-w-[14rem]">
        <p className="text-sm text-kp-white leading-tight">{art.nombre}</p>
        <p className="text-2xs text-kp-gray font-mono mt-0.5">{art.codigo} · {art.categoria ?? 'Sin categoría'}</p>
        {error && <p className="text-2xs text-kp-red mt-1">{error}</p>}
      </td>
      <td className="px-3 py-2.5 text-xs text-kp-gray-lt whitespace-nowrap tabular-nums">
        {art.stock.length === 0 ? '—' : art.stock.map(s => (
          <div key={s.sucursal}>
            <span className="text-kp-gray">{s.sucursal}:</span>{' '}
            {convertido ? formatoStock(s.cantidad, upbVista) : `${Number(s.cantidad).toLocaleString('es-AR')} bultos`}
          </div>
        ))}
      </td>
      <td className="px-3 py-2.5 w-28">
        <NumericInput
          decimals={0}
          value={factor}
          disabled={convertido || guardando}
          onChange={e => { setFactor(e.target.value); if (!precioManual) setPrecio(sugerido(e.target.value)); setError(''); }}
          placeholder="—"
          aria-label={`Unidades por bulto de ${art.nombre}`}
          className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-2 py-1.5 text-sm text-right text-kp-white focus:outline-none focus:border-kp-red disabled:opacity-60"
        />
        <p className={cn('text-2xs mt-0.5 text-right', convertido ? 'text-kp-gray' : conf.cls)}>
          {convertido ? 'fijo' : conf.txt}
        </p>
      </td>
      <td className="px-3 py-2.5 w-36">
        <NumericInput
          decimals={3}
          value={precio}
          disabled={guardando}
          onChange={e => { setPrecio(e.target.value); setPrecioManual(true); setError(''); }}
          placeholder="0"
          aria-label={`Precio por unidad de ${art.nombre}`}
          className="w-full bg-kp-surface2 border border-kp-border rounded-lg px-2 py-1.5 text-sm text-right text-kp-white focus:outline-none focus:border-kp-red"
        />
        <p className="text-2xs text-kp-gray mt-0.5 text-right">
          {referencia == null
            ? `bulto: ${ars.format(madre)}`
            : inicial
              ? `bulto ÷ ${nFactor} × 2: ${ars.format(precioUnidadInicial(madre, nFactor))}`
              : `bulto ÷ ${nFactor}: ${ars.format(referencia)}`}
        </p>
      </td>
      <td className="px-3 py-2.5 w-24 text-right">
        {art.vende_por_unidad && precioCambio && (
          <button onClick={guardarPrecio} disabled={guardando} className="text-xs font-semibold text-kp-red hover:underline disabled:opacity-40">
            {guardando ? '…' : 'Guardar precio'}
          </button>
        )}
      </td>

      <Modal
        open={confirmar}
        onClose={() => !guardando && setConfirmar(false)}
        title="Habilitar venta por unidad"
        subtitle={art.nombre}
        size="sm"
        footer={
          <>
            <button type="button" onClick={() => setConfirmar(false)} disabled={guardando} className={btnSecondary}>Cancelar</button>
            <button type="button" onClick={activar} disabled={guardando} className={btnPrimary}>
              {guardando ? 'Guardando…' : convertido ? 'Habilitar' : 'Convertir y habilitar'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-kp-gray-lt">
            Bulto de <span className="font-semibold text-kp-white">{nFactor} unidades</span>, precio por unidad{' '}
            <span className="font-semibold text-kp-white">{precioOk ? ars.format(nPrecio) : '—'}</span>.
          </p>
          {!convertido && (
            <>
              <p className="text-kp-gray-lt">El stock pasa a contarse en unidades, en las dos sucursales:</p>
              <ul className="rounded-lg border border-kp-border divide-y divide-kp-border">
                {art.stock.length === 0 && <li className="px-3 py-2 text-kp-gray">Sin stock cargado</li>}
                {art.stock.map(s => (
                  <li key={s.sucursal} className="px-3 py-2 flex justify-between gap-3 tabular-nums">
                    <span className="text-kp-gray">{s.sucursal}</span>
                    <span className="text-kp-white">
                      {Number(s.cantidad).toLocaleString('es-AR')} bultos → {(Number(s.cantidad) * nFactor).toLocaleString('es-AR')} u.
                    </span>
                  </li>
                ))}
              </ul>
              <p className={errorCls}>
                Las unidades por bulto quedan fijas: después no se pueden cambiar. Hacelo con este artículo contado.
              </p>
            </>
          )}
        </div>
      </Modal>
    </tr>
  );
}

export default function VentaPorUnidad() {
  const [arts, setArts] = useState<Art[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('inicial');

  const cargar = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await apiFetch('/api/articulos/venta-por-unidad');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'No se pudo cargar');
      setArts(d.articulos ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const onCambio = (a: Art) => setArts(prev => prev.map(x => x.id === a.id ? a : x));

  const habilitados = arts.filter(a => a.vende_por_unidad).length;
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return arts.filter(a => {
      if (filtro === 'inicial' && !LISTA_INICIAL.has(a.codigo)) return false;
      if (filtro === 'habilitados' && !a.vende_por_unidad) return false;
      if (filtro === 'sugeridos' && !a.vende_por_unidad && !a.factor_sugerido && a.unidades_por_bulto <= 1) return false;
      if (!t) return true;
      return a.nombre.toLowerCase().includes(t) || a.codigo.toLowerCase().includes(t) || (a.categoria ?? '').toLowerCase().includes(t);
    });
  }, [arts, q, filtro]);

  const filtros: { key: Filtro; label: string }[] = [
    { key: 'inicial',     label: `Lista inicial (${arts.filter(a => LISTA_INICIAL.has(a.codigo)).length})` },
    { key: 'sugeridos',   label: 'Con bulto en el nombre' },
    { key: 'habilitados', label: `Habilitados (${habilitados})` },
    { key: 'todos',       label: 'Todos' },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-kp-gray">
        Solo los artículos tildados se pueden vender por unidad. Al tildar uno por primera vez, su stock se convierte a
        unidades en ese momento. Destildarlo solo lo saca de la venta suelta.
      </p>

      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre, código o categoría…"
          className={cn(inputCls, 'md:max-w-sm')}
        />
        <div className="flex gap-1 flex-wrap" role="group" aria-label="Filtro">
          {filtros.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltro(f.key)}
              aria-pressed={filtro === f.key}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                filtro === f.key ? 'border-kp-red text-kp-white bg-kp-red/10' : 'border-kp-border text-kp-gray hover:text-kp-white',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className={errorCls}>{error}</p>}

      <div className="rounded-xl border border-kp-border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-kp-surface2 border-b border-kp-border text-left">
              <th className="px-3 py-2 text-2xs text-kp-gray uppercase tracking-widest font-semibold w-10">Suelto</th>
              <th className="px-3 py-2 text-2xs text-kp-gray uppercase tracking-widest font-semibold">Artículo</th>
              <th className="px-3 py-2 text-2xs text-kp-gray uppercase tracking-widest font-semibold">Stock</th>
              <th className="px-3 py-2 text-2xs text-kp-gray uppercase tracking-widest font-semibold text-right">U. por bulto</th>
              <th className="px-3 py-2 text-2xs text-kp-gray uppercase tracking-widest font-semibold text-right">Precio unidad</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="bg-kp-surface">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-kp-gray">Cargando…</td></tr>
            ) : visibles.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-kp-gray">Sin artículos para mostrar</td></tr>
            ) : visibles.map(a => <Fila key={a.id} art={a} onCambio={onCambio} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
