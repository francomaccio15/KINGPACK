'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';

interface CategoriaCierre {
  categoria_id: string;
  categoria:    string;
  orden:        number;
  seccion:      string;
  monto_actual: number;
  confirmado:   boolean;
}

interface EgresoDetalle {
  id:           string;
  fecha:        string;
  proveedor:    string;
  descripcion:  string | null;
  comprobante:  string | null;
  rubro:        string;
  subrubro:     string;
  monto:        number;
  estado_pago:  string | null;
  sucursal:     string | null;
}

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS',
  minimumFractionDigits: 0, maximumFractionDigits: 0,
});

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function CierreMensual({ anio, mes }: { anio: number; mes: number }) {
  const router = useRouter();
  const [cats, setCats]       = useState<CategoriaCierre[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<Record<string, EgresoDetalle[] | 'loading'>>({});

  const cargar = useCallback(async () => {
    const res = await apiFetch(`/api/reportes/estado-resultados/cierre?anio=${anio}&mes=${mes}`);
    if (res.ok) {
      const data = await res.json();
      setCats(data.categorias || []);
    }
    setLoading(false);
  }, [anio, mes]);

  useEffect(() => { cargar(); }, [cargar]);

  async function toggleDetalle(categoria_resultado_id: string) {
    if (abierta === categoria_resultado_id) { setAbierta(null); return; }
    setAbierta(categoria_resultado_id);
    if (!detalles[categoria_resultado_id]) {
      setDetalles(d => ({ ...d, [categoria_resultado_id]: 'loading' }));
      const res = await apiFetch(
        `/api/reportes/estado-resultados/cierre/detalle?anio=${anio}&mes=${mes}&categoria_resultado_id=${categoria_resultado_id}`
      );
      const data = res.ok ? await res.json() : { egresos: [] };
      setDetalles(d => ({ ...d, [categoria_resultado_id]: data.egresos || [] }));
    }
  }

  async function confirmar(categoria_resultado_id: string) {
    setBusy(categoria_resultado_id);
    await apiFetch('/api/reportes/estado-resultados/cierre/confirmar', {
      method: 'POST',
      body: JSON.stringify({ anio, mes, categoria_resultado_id }),
    });
    await cargar();
    setBusy(null);
  }

  async function reabrir(categoria_resultado_id: string) {
    setBusy(categoria_resultado_id);
    await apiFetch('/api/reportes/estado-resultados/cierre/reabrir', {
      method: 'POST',
      body: JSON.stringify({ anio, mes, categoria_resultado_id }),
    });
    await cargar();
    setBusy(null);
  }

  const faltan = cats.filter(c => !c.confirmado).length;
  const listo  = cats.length > 0 && faltan === 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-kp-border bg-kp-surface p-8 text-center">
        <p className="text-kp-gray text-sm">Cargando cierre mensual…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado */}
      <div className="rounded-xl border border-kp-border bg-kp-surface2 p-5">
        <h2 className="text-lg font-black text-kp-white tracking-tight">
          Cierre mensual — {MESES[mes - 1]} {anio}
        </h2>
        <p className="text-sm text-kp-gray mt-1">
          Antes de calcular el estado de resultados, confirmá cada categoría de gasto del mes.
          Si una no tuvo movimientos, confirmala en <span className="text-kp-white font-semibold">$0</span>.
          {faltan > 0
            ? <span className="text-orange-300 font-semibold"> Faltan confirmar {faltan} categoría{faltan !== 1 ? 's' : ''}.</span>
            : <span className="text-emerald-400 font-semibold"> Todas confirmadas.</span>}
        </p>
      </div>

      {/* Lista de categorías */}
      <div className="rounded-xl border border-kp-border overflow-hidden">
        <div className="overflow-x-auto">
<table data-rt="1" className="w-full">
          <thead>
            <tr className="border-b-2 border-kp-border bg-kp-surface2/60">
              <th className="px-5 py-2.5 text-left text-xs font-bold uppercase tracking-widest text-kp-gray">Categoría</th>
              <th className="px-5 py-2.5 text-right text-xs font-bold uppercase tracking-widest text-kp-gray">Monto del mes</th>
              <th className="px-5 py-2.5 text-right text-xs font-bold uppercase tracking-widest text-kp-gray w-64">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cats.map(c => (
              <Fragment key={c.categoria_id}>
              <tr className="border-b border-kp-border/40 hover:bg-kp-surface2/30 transition-colors">
                <td className="px-5 py-3 text-sm font-semibold text-kp-white">
                  <button
                    type="button"
                    onClick={() => toggleDetalle(c.categoria_id)}
                    className="flex items-center gap-2 text-left hover:text-kp-red transition-colors"
                    disabled={c.monto_actual === 0}
                    title={c.monto_actual === 0 ? 'Sin movimientos' : 'Ver comprobantes'}>
                    <span className={['text-xs text-kp-gray transition-transform', abierta === c.categoria_id ? 'rotate-90' : '', c.monto_actual === 0 ? 'opacity-0' : ''].join(' ')}>▶</span>
                    {c.categoria}
                  </button>
                </td>
                <td className={['px-5 py-3 text-sm text-right tabular-nums', c.monto_actual === 0 ? 'text-kp-gray/50' : 'text-kp-white'].join(' ')}>
                  {ars.format(c.monto_actual)}
                </td>
                <td className="px-5 py-3 text-right">
                  {c.confirmado ? (
                    <div className="flex items-center justify-end gap-3">
                      <span className="text-emerald-400 text-sm font-semibold">✓ Confirmado</span>
                      <button
                        onClick={() => reabrir(c.categoria_id)}
                        disabled={busy === c.categoria_id}
                        className="text-xs text-kp-gray hover:text-orange-300 underline disabled:opacity-50">
                        reabrir
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => confirmar(c.categoria_id)}
                      disabled={busy === c.categoria_id}
                      className="px-3 py-1.5 rounded-lg bg-kp-red text-white text-xs font-semibold hover:bg-kp-red/80 transition-colors disabled:opacity-50">
                      {busy === c.categoria_id
                        ? 'Guardando…'
                        : c.monto_actual === 0 ? 'Marcar en $0 y confirmar' : 'Confirmar'}
                    </button>
                  )}
                </td>
              </tr>
              {abierta === c.categoria_id && (
                <tr className="bg-kp-surface2/20">
                  <td colSpan={3} className="px-5 py-3">
                    {detalles[c.categoria_id] === 'loading' ? (
                      <p className="text-xs text-kp-gray py-2">Cargando comprobantes…</p>
                    ) : (detalles[c.categoria_id] as EgresoDetalle[])?.length ? (
                      <div className="overflow-x-auto rounded-lg border border-kp-border/50">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-kp-gray border-b border-kp-border/50">
                              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                              <th className="px-3 py-2 text-left font-semibold">Proveedor</th>
                              <th className="px-3 py-2 text-left font-semibold">Comprobante</th>
                              <th className="px-3 py-2 text-left font-semibold">Rubro / Subrubro</th>
                              <th className="px-3 py-2 text-left font-semibold">Sucursal</th>
                              <th className="px-3 py-2 text-right font-semibold">Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(detalles[c.categoria_id] as EgresoDetalle[]).map(e => (
                              <tr key={e.id} className="border-b border-kp-border/20 hover:bg-kp-surface2/40">
                                <td className="px-3 py-2 whitespace-nowrap text-kp-gray">{e.fecha}</td>
                                <td className="px-3 py-2 text-kp-white">{e.proveedor}{e.descripcion && e.descripcion !== e.proveedor ? <span className="text-kp-gray"> — {e.descripcion}</span> : null}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-kp-gray">{e.comprobante || '—'}</td>
                                <td className="px-3 py-2 text-kp-gray">{e.rubro} <span className="opacity-60">/ {e.subrubro}</span></td>
                                <td className="px-3 py-2 whitespace-nowrap text-kp-gray">{e.sucursal || '—'}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-kp-white">{ars.format(e.monto)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-kp-gray py-2">Sin comprobantes en el período.</p>
                    )}
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Acción final */}
      {listo && (
        <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-5 flex items-center justify-between">
          <p className="text-sm text-emerald-300 font-semibold">
            Todas las categorías están confirmadas. Ya podés calcular el estado de resultados.
          </p>
          <button
            onClick={() => router.refresh()}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors">
            Ver estado de resultados
          </button>
        </div>
      )}
    </div>
  );
}
